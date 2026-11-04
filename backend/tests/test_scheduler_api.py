# Regression tests for group scheduler API (auth, groups, plans, occurrences, free-days, meetings, admin)
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

def _load_url():
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
    if not url:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")

BASE = _load_url() + "/api"
TODAY = date.today()
D = lambda n: (TODAY + timedelta(days=n)).isoformat()


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


def register(name=None, pw="x"):
    name = name or f"TEST_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{BASE}/auth/register", json={"username": name, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{BASE}/auth/login", json={"username": "Borys", "password": "Borys2010"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def ctx(admin):
    a, b, c = register(), register(), register()
    g = requests.post(f"{BASE}/groups", json={"name": "TEST_grp"}, headers=h(a["token"])).json()
    # b joins up front so classes can run on separate xdist workers (loadscope)
    requests.post(f"{BASE}/groups/join", json={"code": g["code"]}, headers=h(b["token"]))
    ctx_data = {"a": a, "b": b, "c": c, "g": g}
    yield ctx_data
    for u in (a, b, c):
        requests.delete(f"{BASE}/admin/users/{u['user']['id']}", headers=h(admin["token"]))
    for key in ("g", "g2", "g3"):
        if key in ctx_data:
            requests.delete(f"{BASE}/admin/groups/{ctx_data[key]['id']}", headers=h(admin["token"]))


# --- Auth
class TestAuth:
    def test_admin_seed(self, admin):
        assert admin["user"]["role"] == "admin" and admin["user"]["username"] == "Borys"

    def test_admin_login_case_insensitive(self):
        r = requests.post(f"{BASE}/auth/login", json={"username": "borys", "password": "Borys2010"})
        assert r.status_code == 200

    def test_register_me_wrong_pw_duplicate(self, ctx):
        a = ctx["a"]
        me = requests.get(f"{BASE}/auth/me", headers=h(a["token"]))
        assert me.status_code == 200 and me.json()["username"] == a["user"]["username"]
        assert "password_hash" not in me.json()
        r = requests.post(f"{BASE}/auth/login", json={"username": a["user"]["username"], "password": "bad"})
        assert r.status_code == 401
        r = requests.post(f"{BASE}/auth/register", json={"username": a["user"]["username"].upper(), "password": "1"})
        assert r.status_code == 409

    def test_no_token_401(self):
        assert requests.get(f"{BASE}/auth/me").status_code == 401


# --- Groups
class TestGroups:
    def test_join_members_colors(self, ctx):
        g, b = ctx["g"], ctx["b"]
        assert len(g["code"]) == 6
        r = requests.post(f"{BASE}/groups/join", json={"code": g["code"].lower()}, headers=h(b["token"]))
        assert r.status_code == 200 and r.json()["member_count"] == 2
        me = requests.get(f"{BASE}/auth/me", headers=h(b["token"])).json()
        assert me["active_group_id"] == g["id"]
        mem = requests.get(f"{BASE}/groups/{g['id']}/members", headers=h(b["token"])).json()
        assert [m["color_index"] for m in mem] == [0, 1]
        assert mem[0]["is_owner"] is True

    def test_join_bad_code(self, ctx):
        r = requests.post(f"{BASE}/groups/join", json={"code": "ZZZZZZ9"}, headers=h(ctx["c"]["token"]))
        assert r.status_code == 404

    def test_non_member_403(self, ctx):
        r = requests.get(f"{BASE}/groups/{ctx['g']['id']}/members", headers=h(ctx["c"]["token"]))
        assert r.status_code == 403

    def test_activate_and_leave(self, ctx):
        c = ctx["c"]
        g2 = requests.post(f"{BASE}/groups", json={"name": "TEST_g2"}, headers=h(c["token"])).json()
        g3 = requests.post(f"{BASE}/groups", json={"name": "TEST_g3"}, headers=h(c["token"])).json()
        r = requests.post(f"{BASE}/groups/{g2['id']}/activate", headers=h(c["token"]))
        assert r.status_code == 200
        assert requests.get(f"{BASE}/auth/me", headers=h(c["token"])).json()["active_group_id"] == g2["id"]
        r = requests.post(f"{BASE}/groups/{g2['id']}/leave", headers=h(c["token"]))
        assert r.status_code == 200
        ids = [x["id"] for x in requests.get(f"{BASE}/groups", headers=h(c["token"])).json()]
        assert g2["id"] not in ids and g3["id"] in ids
        assert requests.get(f"{BASE}/auth/me", headers=h(c["token"])).json()["active_group_id"] is None
        ctx["g2"], ctx["g3"] = g2, g3


# --- Plans + occurrences
class TestPlans:
    def test_once_crud(self, ctx):
        t = h(ctx["a"]["token"])
        r = requests.post(f"{BASE}/plans", json={"title": "TEST_once", "kind": "once", "date": D(2),
                                                 "start_time": "09:15", "end_time": "10:45"}, headers=t)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["start_time"] == "09:15" and p["date"] == D(2)
        r = requests.put(f"{BASE}/plans/{p['id']}", json={"title": "TEST_once2", "kind": "once", "date": D(3),
                                                          "start_time": "09:15", "end_time": "10:46"}, headers=t)
        assert r.status_code == 200 and r.json()["title"] == "TEST_once2"
        lst = requests.get(f"{BASE}/plans", headers=t).json()
        assert any(x["id"] == p["id"] and x["date"] == D(3) for x in lst)
        # other user can't edit
        r = requests.delete(f"{BASE}/plans/{p['id']}", headers=h(ctx["b"]["token"]))
        assert r.status_code == 403
        assert requests.delete(f"{BASE}/plans/{p['id']}", headers=t).status_code == 200
        assert not any(x["id"] == p["id"] for x in requests.get(f"{BASE}/plans", headers=t).json())

    def test_validation(self, ctx):
        t = h(ctx["a"]["token"])
        r = requests.post(f"{BASE}/plans", json={"title": "TEST_x", "kind": "once", "date": D(1),
                                                 "start_time": "10:00", "end_time": "09:00"}, headers=t)
        assert r.status_code == 400
        r = requests.post(f"{BASE}/plans", json={"title": "TEST_x", "kind": "weekly", "weekdays": [],
                                                 "start_date": D(0), "start_time": "10:00", "end_time": "11:00"}, headers=t)
        assert r.status_code == 400
        r = requests.post(f"{BASE}/plans", json={"title": "TEST_x", "kind": "once", "date": D(1),
                                                 "start_time": "25:00", "end_time": "26:00"}, headers=t)
        assert r.status_code == 422

    def test_weekly_occurrences_and_sharing(self, ctx):
        t = h(ctx["a"]["token"])
        start = TODAY - timedelta(days=TODAY.weekday())  # Monday this week
        r = requests.post(f"{BASE}/plans", json={"title": "TEST_weekly", "kind": "weekly", "weekdays": [0, 2],
                                                 "interval_weeks": 2, "start_date": start.isoformat(),
                                                 "end_date": (start + timedelta(days=34)).isoformat(),
                                                 "start_time": "18:00", "end_time": "19:30"}, headers=t)
        assert r.status_code == 200, r.text
        ctx["weekly_id"] = r.json()["id"]
        q = {"start": start.isoformat(), "end": (start + timedelta(days=41)).isoformat()}
        occ = requests.get(f"{BASE}/occurrences", params=q, headers=t).json()
        dates = sorted(o["date"] for o in occ if o["source_id"] == ctx["weekly_id"])
        exp = [(start + timedelta(days=d)).isoformat() for d in (0, 2, 14, 16, 28, 30)]
        assert dates == exp
        # b (shares group) can view a's occurrences
        r = requests.get(f"{BASE}/occurrences", params={**q, "user_id": ctx["a"]["user"]["id"]}, headers=h(ctx["b"]["token"]))
        assert r.status_code == 200 and len(r.json()) >= 6
        # c doesn't share group
        r = requests.get(f"{BASE}/occurrences", params={**q, "user_id": ctx["a"]["user"]["id"]}, headers=h(ctx["c"]["token"]))
        assert r.status_code == 403
        # group occurrences
        r = requests.get(f"{BASE}/groups/{ctx['g']['id']}/occurrences", params=q, headers=h(ctx["b"]["token"]))
        assert r.status_code == 200 and any(o["source_id"] == ctx["weekly_id"] for o in r.json())

    def test_bad_range(self, ctx):
        r = requests.get(f"{BASE}/occurrences", params={"start": D(10), "end": D(0)}, headers=h(ctx["a"]["token"]))
        assert r.status_code == 400

    def test_invalid_calendar_date_range_not_500(self, ctx):
        r = requests.get(f"{BASE}/occurrences", params={"start": "2026-13-01", "end": "2026-13-05"}, headers=h(ctx["a"]["token"]))
        assert r.status_code in (400, 422), f"got {r.status_code}"

    def test_invalid_plan_date_rejected(self, ctx):
        t = h(ctx["b"]["token"])
        r = requests.post(f"{BASE}/plans", json={"title": "TEST_bad", "kind": "once", "date": "2026-02-31",
                                                 "start_time": "10:00", "end_time": "11:00"}, headers=t)
        if r.status_code == 200:
            pid = r.json()["id"]
            occ = requests.get(f"{BASE}/occurrences", params={"start": D(0), "end": D(5)}, headers=t)
            requests.delete(f"{BASE}/plans/{pid}", headers=t)
            pytest.fail(f"Invalid date 2026-02-31 accepted; occurrences then returned {occ.status_code}")


# --- Free days + meetings
class TestFreeDaysMeetings:
    def test_free_days_and_meeting_flow(self, ctx):
        a, b, g = ctx["a"], ctx["b"], ctx["g"]
        tb = h(b["token"])
        # b has plan on D(5)
        p = requests.post(f"{BASE}/plans", json={"title": "TEST_b", "kind": "once", "date": D(5),
                                                 "start_time": "08:00", "end_time": "09:00"}, headers=tb).json()
        q = {"start": D(4), "end": D(12)}
        fd = requests.get(f"{BASE}/groups/{g['id']}/free-days", params=q, headers=tb)
        assert fd.status_code == 200
        free = {x["date"] for x in fd.json()}
        assert D(5) not in free
        # a's weekly plan days excluded too
        occ = requests.get(f"{BASE}/groups/{g['id']}/occurrences", params=q, headers=tb).json()
        assert not ({o["date"] for o in occ} & free)
        free_day = sorted(free)[0]
        # b proposes meeting on free day
        r = requests.post(f"{BASE}/groups/{g['id']}/meetings", json={"date": free_day, "title": "TEST_meet",
                                                                    "place": "Park", "start_time": "17:00", "end_time": "19:00"}, headers=tb)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["rsvps"][b["user"]["id"]] == "yes"
        ta = h(a["token"])
        r = requests.post(f"{BASE}/meetings/{m['id']}/rsvp", json={"status": "yes"}, headers=ta)
        assert r.status_code == 200 and r.json()["rsvps"][a["user"]["id"]] == "yes"
        occ_a = requests.get(f"{BASE}/occurrences", params={"start": free_day, "end": free_day}, headers=ta).json()
        assert any(o["type"] == "meeting" and o["source_id"] == m["id"] for o in occ_a)
        r = requests.post(f"{BASE}/meetings/{m['id']}/rsvp", json={"status": "no"}, headers=ta)
        occ_a = requests.get(f"{BASE}/occurrences", params={"start": free_day, "end": free_day}, headers=ta).json()
        assert not any(o["source_id"] == m["id"] for o in occ_a)
        # iteration 2: own-group meeting day stays listed in free-days with its meeting attached
        fd2 = {x["date"]: x for x in requests.get(f"{BASE}/groups/{g['id']}/free-days", params=q, headers=tb).json()}
        assert free_day in fd2 and fd2[free_day]["meeting"]["id"] == m["id"]
        # update
        r = requests.put(f"{BASE}/meetings/{m['id']}", json={"date": free_day, "title": "TEST_meet2", "notes": "n"}, headers=ta)
        assert r.status_code == 200 and r.json()["title"] == "TEST_meet2" and r.json()["start_time"] is None
        lst = requests.get(f"{BASE}/groups/{g['id']}/meetings", headers=tb).json()
        assert any(x["id"] == m["id"] and x["title"] == "TEST_meet2" for x in lst)
        # non-member rsvp 403
        assert requests.post(f"{BASE}/meetings/{m['id']}/rsvp", json={"status": "yes"},
                             headers=h(ctx["c"]["token"])).status_code == 403
        # a is group owner -> can delete
        assert requests.delete(f"{BASE}/meetings/{m['id']}", headers=ta).status_code == 200
        assert not any(x["id"] == m["id"] for x in requests.get(f"{BASE}/groups/{g['id']}/meetings", headers=tb).json())
        requests.delete(f"{BASE}/plans/{p['id']}", headers=tb)

    def test_meeting_time_validation(self, ctx):
        r = requests.post(f"{BASE}/groups/{ctx['g']['id']}/meetings", json={"date": D(6), "title": "TEST_v",
                          "start_time": "18:00", "end_time": "17:00"}, headers=h(ctx["a"]["token"]))
        assert r.status_code == 400


# --- Admin
class TestAdmin:
    def test_non_admin_403(self, ctx):
        t = h(ctx["a"]["token"])
        for method, path in [("get", "/admin/users"), ("get", "/admin/groups"),
                             ("delete", f"/admin/groups/{ctx['g']['id']}")]:
            assert getattr(requests, method)(f"{BASE}{path}", headers=t).status_code == 403

    def test_admin_list_rename_role_reset(self, admin, ctx):
        ta = h(admin["token"])
        users = requests.get(f"{BASE}/admin/users", headers=ta).json()
        c = next(u for u in users if u["id"] == ctx["c"]["user"]["id"])
        assert "plan_count" in c and "groups" in c and "password_hash" not in c
        new = f"TEST_ren{uuid.uuid4().hex[:5]}"
        r = requests.put(f"{BASE}/admin/users/{c['id']}", json={"username": new, "role": "admin"}, headers=ta)
        assert r.status_code == 200 and r.json()["username"] == new and r.json()["role"] == "admin"
        r = requests.put(f"{BASE}/admin/users/{c['id']}", json={"username": "Borys"}, headers=ta)
        assert r.status_code == 409
        requests.put(f"{BASE}/admin/users/{c['id']}", json={"role": "user"}, headers=ta)
        assert requests.post(f"{BASE}/admin/users/{c['id']}/reset-password", json={"password": "np"}, headers=ta).status_code == 200
        assert requests.post(f"{BASE}/auth/login", json={"username": new, "password": "np"}).status_code == 200
        r = requests.put(f"{BASE}/admin/users/{admin['user']['id']}", json={"role": "user"}, headers=ta)
        assert r.status_code == 400

    def test_admin_groups_remove_member_delete_group(self, admin, ctx):
        ta = h(admin["token"])
        gs = requests.get(f"{BASE}/admin/groups", headers=ta).json()
        g = next(x for x in gs if x["id"] == ctx["g"]["id"])
        assert len(g["members"]) == 2
        r = requests.delete(f"{BASE}/admin/groups/{g['id']}/members/{ctx['b']['user']['id']}", headers=ta)
        assert r.status_code == 200
        mem = requests.get(f"{BASE}/groups/{g['id']}/members", headers=h(ctx["a"]["token"])).json()
        assert [m["id"] for m in mem] == [ctx["a"]["user"]["id"]]
        g3 = ctx.get("g3")
        if g3:
            assert requests.delete(f"{BASE}/admin/groups/{g3['id']}", headers=ta).status_code == 200
            assert requests.get(f"{BASE}/groups/{g3['id']}", headers=h(ctx["c"]["token"])).status_code == 404

    def test_admin_delete_user_cascade(self, admin, ctx):
        ta = h(admin["token"])
        u = register()
        requests.post(f"{BASE}/groups/join", json={"code": ctx["g"]["code"]}, headers=h(u["token"]))
        requests.post(f"{BASE}/plans", json={"title": "TEST_c", "kind": "once", "date": D(1),
                                             "start_time": "10:00", "end_time": "11:00"}, headers=h(u["token"]))
        assert requests.delete(f"{BASE}/admin/users/{u['user']['id']}", headers=ta).status_code == 200
        assert requests.get(f"{BASE}/auth/me", headers=h(u["token"])).status_code == 401
        mem = requests.get(f"{BASE}/groups/{ctx['g']['id']}/members", headers=h(ctx["a"]["token"])).json()
        assert u["user"]["id"] not in [m["id"] for m in mem]
        plans = requests.get(f"{BASE}/admin/users/{u['user']['id']}/plans", headers=ta).json()
        assert plans == []
        assert requests.delete(f"{BASE}/admin/users/{admin['user']['id']}", headers=ta).status_code == 400
