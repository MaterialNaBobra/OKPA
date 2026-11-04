# Helper (not a test): TEST_ data for iteration-3 UI checks (shared calendar meeting blocks); writes /tmp/ui_seed3.json
# Usage: python ui_seed_it3.py           -> create
#        python ui_seed_it3.py cleanup   -> delete created records by id
import json, sys, uuid
from datetime import date, timedelta
import requests
sys.path.insert(0, "/app/backend/tests")
from test_scheduler_api import BASE, h

if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
    s = json.load(open("/tmp/ui_seed3.json"))
    adm = requests.post(f"{BASE}/auth/login", json={"username": "Borys", "password": "Borys2010"}).json()["token"]
    for mid in s["mids"]:
        print("del meeting", requests.delete(f"{BASE}/meetings/{mid}", headers=h(adm)).status_code)
    for pid, tok in s["pids"]:
        print("del plan", requests.delete(f"{BASE}/plans/{pid}", headers=h(tok)).status_code)
    for u in s["users"]:
        print("del user", requests.delete(f"{BASE}/admin/users/{u['id']}", headers=h(adm)).status_code)
    print("del group", requests.delete(f"{BASE}/admin/groups/{s['g']['id']}", headers=h(adm)).status_code)
    sys.exit(0)

D = lambda n: (date.today() + timedelta(days=n)).isoformat()
sfx = uuid.uuid4().hex[:4]
us = [requests.post(f"{BASE}/auth/register", json={"username": f"TEST_u{i}{sfx}", "password": "test123"}).json() for i in (1, 2, 3)]
t = [u["token"] for u in us]
g = requests.post(f"{BASE}/groups", json={"name": f"TEST_g{sfx}"}, headers=h(t[0])).json()
for tok in t[1:]:
    requests.post(f"{BASE}/groups/join", json={"code": g["code"]}, headers=h(tok))
    requests.post(f"{BASE}/groups/{g['id']}/activate", headers=h(tok))
requests.post(f"{BASE}/groups/{g['id']}/activate", headers=h(t[0]))
p1 = requests.post(f"{BASE}/plans", json={"title": "TEST_praca", "kind": "once", "date": D(1), "start_time": "09:00", "end_time": "11:00"}, headers=h(t[0])).json()
p2 = requests.post(f"{BASE}/plans", json={"title": "TEST_silownia", "kind": "once", "date": D(1), "start_time": "13:00", "end_time": "15:00"}, headers=h(t[1])).json()
# Meeting A: 3 attendees (creator u1 auto-yes, u2 + u3 RSVP yes)
mA = requests.post(f"{BASE}/groups/{g['id']}/meetings", json={"date": D(1), "title": "TEST_pizzaA", "start_time": "18:00", "end_time": "20:00", "place": "Rynek"}, headers=h(t[0])).json()
for tok in t[1:]:
    requests.post(f"{BASE}/meetings/{mA['id']}/rsvp", json={"status": "yes"}, headers=h(tok))
# Meeting B: 0 attendees (creator u3 sets RSVP no)
mB = requests.post(f"{BASE}/groups/{g['id']}/meetings", json={"date": D(2), "title": "TEST_kinoB", "start_time": "12:00", "end_time": "13:00"}, headers=h(t[2])).json()
requests.post(f"{BASE}/meetings/{mB['id']}/rsvp", json={"status": "no"}, headers=h(t[2]))
out = {"users": [u["user"] for u in us], "tokens": t, "g": g, "mids": [mA["id"], mB["id"]],
       "pids": [[p1["id"], t[0]], [p2["id"], t[1]]], "d1": D(1), "d2": D(2)}
json.dump(out, open("/tmp/ui_seed3.json", "w"))
print(json.dumps({"users": [u["user"]["username"] for u in us], "mA": mA["id"], "mB": mB["id"], "d1": D(1), "d2": D(2), "p1": p1.get("id"), "p2": p2.get("id")}))
