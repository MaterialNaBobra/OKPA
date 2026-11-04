import asyncio
import logging
import os
import random
import string
import uuid
from contextlib import suppress
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_USERNAME = os.environ["ADMIN_USERNAME"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
TOKEN_DAYS = 30
COLOR_COUNT = 12

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("username_lower", ASCENDING)], name="username_lower", unique=True),
    ],
    "groups": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("code", ASCENDING)], name="code", unique=True),
        IndexModel([("member_ids", ASCENDING)], name="member_ids"),
    ],
    "plans": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING)], name="user_id"),
    ],
    "meetings": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("group_id", ASCENDING), ("date", ASCENDING)], name="group_date"),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def check_pw(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def make_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, JWT_SECRET, algorithm="HS256")


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u["username"],
        "role": u.get("role", "user"),
        "active_group_id": u.get("active_group_id"),
        "created_at": u.get("created_at"),
    }


async def seed_admin() -> None:
    existing = await db.users.find_one({"username_lower": ADMIN_USERNAME.lower()})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "username": ADMIN_USERNAME, "username_lower": ADMIN_USERNAME.lower(),
            "password_hash": hash_pw(ADMIN_PASSWORD), "role": "admin", "active_group_id": None,
            "created_at": now_iso(),
        })
    else:
        update = {"role": "admin"}
        if not check_pw(ADMIN_PASSWORD, existing["password_hash"]):
            update["password_hash"] = hash_pw(ADMIN_PASSWORD)
        await db.users.update_one({"id": existing["id"]}, {"$set": update})


app = FastAPI()
bearer = HTTPBearer(auto_error=False)


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api = APIRouter(prefix="/api")


# ---------------- Auth ----------------
async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(401, "Nie zalogowano")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Sesja wygasła, zaloguj się ponownie")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Konto nie istnieje")
    return user


async def admin_user(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Tylko dla administratora")
    return user


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=1)


class PasswordBody(BaseModel):
    password: str = Field(min_length=1)


@api.post("/auth/register")
async def register(body: Credentials):
    username = body.username.strip()
    if not username:
        raise HTTPException(400, "Podaj login")
    if await db.users.find_one({"username_lower": username.lower()}):
        raise HTTPException(409, "Taki login już istnieje")
    user = {
        "id": str(uuid.uuid4()), "username": username, "username_lower": username.lower(),
        "password_hash": hash_pw(body.password), "role": "user", "active_group_id": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api.post("/auth/login")
async def login(body: Credentials):
    user = await db.users.find_one({"username_lower": body.username.strip().lower()})
    if not user or not check_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Zły login lub hasło")
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@api.post("/auth/change-password")
async def change_password(body: PasswordBody, user: dict = Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(body.password)}})
    return {"ok": True}


# ---------------- Groups ----------------
class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class JoinBody(BaseModel):
    code: str = Field(min_length=1)


def group_out(g: dict) -> dict:
    return {"id": g["id"], "name": g["name"], "code": g["code"], "owner_id": g["owner_id"],
            "member_ids": g["member_ids"], "member_count": len(g["member_ids"])}


async def gen_code() -> str:
    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not await db.groups.find_one({"code": code}):
            return code


async def get_group_for(gid: str, user: dict) -> dict:
    g = await db.groups.find_one({"id": gid}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Grupa nie istnieje")
    if user["id"] not in g["member_ids"] and user.get("role") != "admin":
        raise HTTPException(403, "Nie należysz do tej grupy")
    return g


@api.get("/groups")
async def my_groups(user: dict = Depends(current_user)):
    groups = await db.groups.find({"member_ids": user["id"]}, {"_id": 0}).to_list(200)
    return [group_out(g) for g in groups]


@api.post("/groups")
async def create_group(body: GroupCreate, user: dict = Depends(current_user)):
    g = {"id": str(uuid.uuid4()), "name": body.name.strip(), "code": await gen_code(),
         "owner_id": user["id"], "member_ids": [user["id"]], "created_at": now_iso()}
    await db.groups.insert_one(g)
    await db.users.update_one({"id": user["id"]}, {"$set": {"active_group_id": g["id"]}})
    return group_out(g)


@api.post("/groups/join")
async def join_group(body: JoinBody, user: dict = Depends(current_user)):
    g = await db.groups.find_one({"code": body.code.strip().upper()}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Nie znaleziono grupy z tym kodem")
    if user["id"] not in g["member_ids"]:
        await db.groups.update_one({"id": g["id"]}, {"$push": {"member_ids": user["id"]}})
        g["member_ids"].append(user["id"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"active_group_id": g["id"]}})
    return group_out(g)


@api.post("/groups/{gid}/activate")
async def activate_group(gid: str, user: dict = Depends(current_user)):
    g = await get_group_for(gid, user)
    await db.users.update_one({"id": user["id"]}, {"$set": {"active_group_id": g["id"]}})
    return group_out(g)


async def remove_member(g: dict, uid: str) -> None:
    await db.groups.update_one({"id": g["id"]}, {"$pull": {"member_ids": uid}})
    rest = [m for m in g["member_ids"] if m != uid]
    if not rest:
        await db.groups.delete_one({"id": g["id"]})
        await db.meetings.delete_many({"group_id": g["id"]})
    elif g["owner_id"] == uid:
        await db.groups.update_one({"id": g["id"]}, {"$set": {"owner_id": rest[0]}})
    await db.users.update_one({"id": uid, "active_group_id": g["id"]}, {"$set": {"active_group_id": None}})
    await db.meetings.update_many({"group_id": g["id"]}, {"$unset": {f"rsvps.{uid}": ""}})


@api.post("/groups/{gid}/leave")
async def leave_group(gid: str, user: dict = Depends(current_user)):
    g = await get_group_for(gid, user)
    await remove_member(g, user["id"])
    return {"ok": True}


@api.get("/groups/{gid}")
async def get_group(gid: str, user: dict = Depends(current_user)):
    return group_out(await get_group_for(gid, user))


@api.get("/groups/{gid}/members")
async def group_members(gid: str, user: dict = Depends(current_user)):
    g = await get_group_for(gid, user)
    users = await db.users.find({"id": {"$in": g["member_ids"]}}, {"_id": 0}).to_list(500)
    by_id = {u["id"]: u for u in users}
    out = []
    for idx, uid in enumerate(g["member_ids"]):
        u = by_id.get(uid)
        if u:
            out.append({"id": uid, "username": u["username"], "role": u.get("role", "user"),
                        "color_index": idx % COLOR_COUNT, "is_owner": uid == g["owner_id"]})
    return out


# ---------------- Plans ----------------
TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$|^24:00$"
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class PlanIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    kind: Literal["once", "weekly"]
    start_time: str = Field(pattern=TIME_PATTERN)
    end_time: str = Field(pattern=TIME_PATTERN)
    date: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    weekdays: List[int] = []  # 0 = Monday
    start_date: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    end_date: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    interval_weeks: int = Field(default=1, ge=1, le=4)
    note: Optional[str] = Field(default=None, max_length=300)


def validate_plan(p: PlanIn) -> dict:
    if p.end_time <= p.start_time:
        raise HTTPException(400, "Koniec musi być po początku")
    d = p.model_dump()
    for v in (p.date, p.start_date, p.end_date):
        if v:
            parse_d(v)
    if p.kind == "once":
        if not p.date:
            raise HTTPException(400, "Podaj datę")
        d.update(weekdays=[], start_date=None, end_date=None, interval_weeks=1)
    else:
        if not p.weekdays or any(w < 0 or w > 6 for w in p.weekdays):
            raise HTTPException(400, "Wybierz dni tygodnia")
        if not p.start_date:
            raise HTTPException(400, "Podaj datę początku")
        if p.end_date and p.end_date < p.start_date:
            raise HTTPException(400, "Data końca przed datą początku")
        d.update(date=None, weekdays=sorted(set(p.weekdays)))
    return d


async def get_own_plan(pid: str, user: dict) -> dict:
    plan = await db.plans.find_one({"id": pid}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Plan nie istnieje")
    if plan["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "To nie twój plan")
    return plan


@api.get("/plans")
async def list_plans(user: dict = Depends(current_user)):
    return await db.plans.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)


@api.post("/plans")
async def create_plan(body: PlanIn, user: dict = Depends(current_user)):
    plan = {"id": str(uuid.uuid4()), "user_id": user["id"], **validate_plan(body), "created_at": now_iso()}
    await db.plans.insert_one(plan)
    plan.pop("_id", None)
    return plan


@api.put("/plans/{pid}")
async def update_plan(pid: str, body: PlanIn, user: dict = Depends(current_user)):
    await get_own_plan(pid, user)
    await db.plans.update_one({"id": pid}, {"$set": validate_plan(body)})
    return await db.plans.find_one({"id": pid}, {"_id": 0})


@api.delete("/plans/{pid}")
async def delete_plan(pid: str, user: dict = Depends(current_user)):
    await get_own_plan(pid, user)
    await db.plans.delete_one({"id": pid})
    return {"ok": True}


# ---------------- Occurrences ----------------
def parse_d(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except (TypeError, ValueError):
        raise HTTPException(400, f"Nieprawidłowa data: {s}")


def expand_plan(plan: dict, start: date, end: date) -> List[dict]:
    base = {"source_id": plan["id"], "user_id": plan["user_id"], "title": plan["title"],
            "start_time": plan["start_time"], "end_time": plan["end_time"], "type": "plan",
            "kind": plan["kind"], "all_day": False}
    if plan["kind"] == "once":
        d = parse_d(plan["date"])
        return [{**base, "date": plan["date"]}] if start <= d <= end else []
    out = []
    s_date = parse_d(plan["start_date"])
    e_date = parse_d(plan["end_date"]) if plan.get("end_date") else end
    first = max(start, s_date)
    last = min(end, e_date)
    anchor = s_date - timedelta(days=s_date.weekday())
    interval = plan.get("interval_weeks", 1)
    d = first
    while d <= last:
        if d.weekday() in plan["weekdays"]:
            weeks = ((d - timedelta(days=d.weekday())) - anchor).days // 7
            if weeks % interval == 0:
                out.append({**base, "date": d.isoformat()})
        d += timedelta(days=1)
    return out


def meeting_occurrence(m: dict, uid: str) -> dict:
    return {"source_id": m["id"], "user_id": uid, "title": m["title"], "date": m["date"],
            "start_time": m.get("start_time") or None, "end_time": m.get("end_time") or None,
            "type": "meeting", "kind": "once", "all_day": not m.get("start_time"),
            "group_id": m["group_id"]}


async def occurrences_for(user_ids: List[str], start: date, end: date, group_id: Optional[str] = None) -> List[dict]:
    out: List[dict] = []
    plans = await db.plans.find({"user_id": {"$in": user_ids}}, {"_id": 0}).to_list(5000)
    for p in plans:
        out.extend(expand_plan(p, start, end))
    mq: dict = {"date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}
    if group_id:
        mq["group_id"] = group_id
    meetings = await db.meetings.find(mq, {"_id": 0}).to_list(2000)
    for m in meetings:
        for uid, status in (m.get("rsvps") or {}).items():
            if status == "yes" and uid in user_ids:
                out.append(meeting_occurrence(m, uid))
    out.sort(key=lambda o: (o["date"], o["start_time"] or "00:00"))
    return out


def check_range(start: str, end: str) -> tuple[date, date]:
    s, e = parse_d(start), parse_d(end)
    if e < s or (e - s).days > 120:
        raise HTTPException(400, "Zły zakres dat")
    return s, e


async def shares_group(a: str, b: str) -> bool:
    return await db.groups.find_one({"member_ids": {"$all": [a, b]}}) is not None


@api.get("/occurrences")
async def user_occurrences(start: str = Query(..., pattern=DATE_PATTERN), end: str = Query(..., pattern=DATE_PATTERN),
                           user_id: Optional[str] = None, user: dict = Depends(current_user)):
    s, e = check_range(start, end)
    uid = user_id or user["id"]
    if uid != user["id"] and user.get("role") != "admin" and not await shares_group(uid, user["id"]):
        raise HTTPException(403, "Brak dostępu do tego planu")
    return await occurrences_for([uid], s, e)


@api.get("/groups/{gid}/occurrences")
async def group_occurrences(gid: str, start: str = Query(..., pattern=DATE_PATTERN),
                            end: str = Query(..., pattern=DATE_PATTERN), user: dict = Depends(current_user)):
    g = await get_group_for(gid, user)
    s, e = check_range(start, end)
    return await occurrences_for(g["member_ids"], s, e)


@api.get("/groups/{gid}/free-days")
async def free_days(gid: str, start: str = Query(..., pattern=DATE_PATTERN),
                    end: str = Query(..., pattern=DATE_PATTERN), user: dict = Depends(current_user)):
    g = await get_group_for(gid, user)
    s, e = check_range(start, end)
    occ = await occurrences_for(g["member_ids"], s, e)
    busy = {o["date"] for o in occ if not (o["type"] == "meeting" and o.get("group_id") == gid)}
    meetings = await db.meetings.find({"group_id": gid, "date": {"$gte": s.isoformat(), "$lte": e.isoformat()}},
                                      {"_id": 0, "date": 1, "id": 1, "title": 1}).to_list(1000)
    meeting_by_date = {m["date"]: {"id": m["id"], "title": m["title"]} for m in meetings}
    out = []
    d = s
    while d <= e:
        iso = d.isoformat()
        if iso not in busy:
            out.append({"date": iso, "meeting": meeting_by_date.get(iso)})
        d += timedelta(days=1)
    return out


# ---------------- Meetings ----------------
class MeetingIn(BaseModel):
    date: str = Field(pattern=DATE_PATTERN)
    title: str = Field(min_length=1, max_length=80)
    start_time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    end_time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    place: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=500)


class RsvpIn(BaseModel):
    status: Literal["yes", "no"]


def validate_meeting(m: MeetingIn) -> dict:
    d = m.model_dump()
    parse_d(m.date)
    if not m.start_time:
        d["end_time"] = None
    elif m.end_time and m.end_time <= m.start_time:
        raise HTTPException(400, "Koniec musi być po początku")
    return d


async def get_meeting_for(mid: str, user: dict) -> tuple[dict, dict]:
    m = await db.meetings.find_one({"id": mid}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Spotkanie nie istnieje")
    g = await get_group_for(m["group_id"], user)
    return m, g


@api.get("/groups/{gid}/meetings")
async def list_meetings(gid: str, include_past: bool = False, user: dict = Depends(current_user)):
    await get_group_for(gid, user)
    q: dict = {"group_id": gid}
    if not include_past:
        q["date"] = {"$gte": (date.today() - timedelta(days=1)).isoformat()}
    return await db.meetings.find(q, {"_id": 0}).sort("date", 1).to_list(500)


@api.post("/groups/{gid}/meetings")
async def create_meeting(gid: str, body: MeetingIn, user: dict = Depends(current_user)):
    await get_group_for(gid, user)
    m = {"id": str(uuid.uuid4()), "group_id": gid, "created_by": user["id"],
         "created_by_name": user["username"], **validate_meeting(body),
         "rsvps": {user["id"]: "yes"}, "created_at": now_iso()}
    await db.meetings.insert_one(m)
    m.pop("_id", None)
    return m


@api.put("/meetings/{mid}")
async def update_meeting(mid: str, body: MeetingIn, user: dict = Depends(current_user)):
    await get_meeting_for(mid, user)
    await db.meetings.update_one({"id": mid}, {"$set": validate_meeting(body)})
    return await db.meetings.find_one({"id": mid}, {"_id": 0})


@api.delete("/meetings/{mid}")
async def delete_meeting(mid: str, user: dict = Depends(current_user)):
    m, g = await get_meeting_for(mid, user)
    if user["id"] not in (m["created_by"], g["owner_id"]) and user.get("role") != "admin":
        raise HTTPException(403, "Tylko autor może usunąć spotkanie")
    await db.meetings.delete_one({"id": mid})
    return {"ok": True}


@api.post("/meetings/{mid}/rsvp")
async def rsvp(mid: str, body: RsvpIn, user: dict = Depends(current_user)):
    m, g = await get_meeting_for(mid, user)
    if user["id"] not in g["member_ids"]:
        raise HTTPException(403, "Nie należysz do tej grupy")
    await db.meetings.update_one({"id": mid}, {"$set": {f"rsvps.{user['id']}": body.status}})
    return await db.meetings.find_one({"id": mid}, {"_id": 0})


# ---------------- Admin ----------------
class AdminUserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=1, max_length=40)
    role: Optional[Literal["user", "admin"]] = None


@api.get("/admin/users")
async def admin_users(_: dict = Depends(admin_user)):
    users = await db.users.find({}, {"_id": 0}).sort("username_lower", 1).to_list(5000)
    groups = await db.groups.find({}, {"_id": 0, "id": 1, "name": 1, "member_ids": 1}).to_list(5000)
    counts: dict = {}
    for p in await db.plans.aggregate([{"$group": {"_id": "$user_id", "n": {"$sum": 1}}}]).to_list(5000):
        counts[p["_id"]] = p["n"]
    out = []
    for u in users:
        out.append({**public_user(u), "plan_count": counts.get(u["id"], 0),
                    "groups": [g["name"] for g in groups if u["id"] in g["member_ids"]]})
    return out


@api.put("/admin/users/{uid}")
async def admin_update_user(uid: str, body: AdminUserUpdate, admin: dict = Depends(admin_user)):
    u = await db.users.find_one({"id": uid}, {"_id": 0})
    if not u:
        raise HTTPException(404, "Użytkownik nie istnieje")
    update: dict = {}
    if body.username:
        name = body.username.strip()
        clash = await db.users.find_one({"username_lower": name.lower(), "id": {"$ne": uid}})
        if clash:
            raise HTTPException(409, "Taki login już istnieje")
        update.update(username=name, username_lower=name.lower())
        await db.meetings.update_many({"created_by": uid}, {"$set": {"created_by_name": name}})
    if body.role:
        if uid == admin["id"] and body.role != "admin":
            raise HTTPException(400, "Nie możesz odebrać sobie uprawnień")
        update["role"] = body.role
    if update:
        await db.users.update_one({"id": uid}, {"$set": update})
    return public_user(await db.users.find_one({"id": uid}, {"_id": 0}))


@api.post("/admin/users/{uid}/reset-password")
async def admin_reset_password(uid: str, body: PasswordBody, _: dict = Depends(admin_user)):
    res = await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_pw(body.password)}})
    if res.matched_count == 0:
        raise HTTPException(404, "Użytkownik nie istnieje")
    return {"ok": True}


@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, admin: dict = Depends(admin_user)):
    if uid == admin["id"]:
        raise HTTPException(400, "Nie możesz usunąć własnego konta")
    if not await db.users.find_one({"id": uid}):
        raise HTTPException(404, "Użytkownik nie istnieje")
    await db.plans.delete_many({"user_id": uid})
    for g in await db.groups.find({"member_ids": uid}, {"_id": 0}).to_list(1000):
        await remove_member(g, uid)
    await db.meetings.update_many({}, {"$unset": {f"rsvps.{uid}": ""}})
    await db.users.delete_one({"id": uid})
    return {"ok": True}


@api.get("/admin/users/{uid}/plans")
async def admin_user_plans(uid: str, _: dict = Depends(admin_user)):
    return await db.plans.find({"user_id": uid}, {"_id": 0}).to_list(1000)


@api.get("/admin/groups")
async def admin_groups(_: dict = Depends(admin_user)):
    groups = await db.groups.find({}, {"_id": 0}).to_list(5000)
    users = {u["id"]: u["username"] for u in await db.users.find({}, {"_id": 0, "id": 1, "username": 1}).to_list(5000)}
    return [{**group_out(g), "members": [{"id": m, "username": users.get(m, "?")} for m in g["member_ids"]]}
            for g in groups]


@api.delete("/admin/groups/{gid}")
async def admin_delete_group(gid: str, _: dict = Depends(admin_user)):
    await db.groups.delete_one({"id": gid})
    await db.meetings.delete_many({"group_id": gid})
    await db.users.update_many({"active_group_id": gid}, {"$set": {"active_group_id": None}})
    return {"ok": True}


@api.delete("/admin/groups/{gid}/members/{uid}")
async def admin_remove_member(gid: str, uid: str, admin: dict = Depends(admin_user)):
    g = await get_group_for(gid, admin)
    await remove_member(g, uid)
    return {"ok": True}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await seed_admin()
    app.state.index_task = asyncio.create_task(ensure_indexes())


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
