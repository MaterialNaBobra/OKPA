# Helper (not a test): creates TEST_ data for iteration-2 UI checks; writes ids to /tmp/ui_seed.json
import json, sys, uuid
from datetime import date, timedelta
import requests
sys.path.insert(0, "/app/backend/tests")
from test_scheduler_api import BASE, h

D = lambda n: (date.today() + timedelta(days=n)).isoformat()
sfx = uuid.uuid4().hex[:5]
u1 = requests.post(f"{BASE}/auth/register", json={"username": f"TEST_ui1{sfx}", "password": "test123"}).json()
u2 = requests.post(f"{BASE}/auth/register", json={"username": f"TEST_ui2{sfx}", "password": "test123"}).json()
g = requests.post(f"{BASE}/groups", json={"name": f"TEST_ui{sfx}"}, headers=h(u1["token"])).json()
requests.post(f"{BASE}/groups/join", json={"code": g["code"]}, headers=h(u2["token"]))
requests.post(f"{BASE}/groups/{g['id']}/activate", headers=h(u1["token"]))
m = requests.post(f"{BASE}/groups/{g['id']}/meetings", json={"date": D(3), "title": "TEST_pizza", "start_time": "18:00",
                  "end_time": "20:00", "place": "Rynek"}, headers=h(u2["token"])).json()
json.dump({"u1": u1["user"], "u2": u2["user"], "g": g, "m": m, "d3": D(3)}, open("/tmp/ui_seed.json", "w"))
print(json.dumps({"u1": u1["user"]["username"], "u2": u2["user"]["username"], "code": g["code"], "mid": m["id"], "d3": D(3)}))
