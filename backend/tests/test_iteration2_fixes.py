# Iteration 2 regression: invalid-date 400s, free-days meeting days, leave/owner reassignment, admin remove member
import uuid
from datetime import date, timedelta

import pytest
import requests

from test_scheduler_api import BASE, h, register

TODAY = date.today()
D = lambda n: (TODAY + timedelta(days=n)).isoformat()
PLAN = {"title": "TEST_p", "kind": "once", "start_time": "10:00", "end_time": "11:00"}


@pytest.fixture(scope="class")
def env():
    adm = requests.post(f"{BASE}/auth/login", json={"username": "Borys", "password": "Borys2010"}).json()
    a, b, c = register(), register(), register()
    g = requests.post(f"{BASE}/groups", json={"name": "TEST_it2"}, headers=h(a["token"])).json()
    requests.post(f"{BASE}/groups/join", json={"code": g["code"]}, headers=h(b["token"]))
    data = {"adm": adm, "a": a, "b": b, "c": c, "g": g, "extra_groups": []}
    yield data
    ta = h(adm["token"])
    for u in (a, b, c):
        requests.delete(f"{BASE}/admin/users/{u['user']['id']}", headers=ta)
    for gid in [g["id"], *data["extra_groups"]]:
        requests.delete(f"{BASE}/admin/groups/{gid}", headers=ta)


class TestIteration2:
    # --- invalid calendar dates -> 400
    def test_invalid_query_dates_400(self, env):
        t = h(env["a"]["token"]); gid = env["g"]["id"]
        for url in (f"{BASE}/occurrences", f"{BASE}/groups/{gid}/occurrences", f"{BASE}/groups/{gid}/free-days"):
            r = requests.get(url, params={"start": "2026-13-01", "end": "2026-13-05"}, headers=t)
            assert r.status_code == 400, f"{url} -> {r.status_code}"
            r = requests.get(url, params={"start": "2026-02-01", "end": "2026-02-30"}, headers=t)
            assert r.status_code == 400, f"{url} feb30 -> {r.status_code}"

    def test_invalid_plan_dates_400(self, env):
        t = h(env["a"]["token"])
        assert requests.post(f"{BASE}/plans", json={**PLAN, "date": "2026-02-31"}, headers=t).status_code == 400
        wk = {**PLAN, "kind": "weekly", "weekdays": [0]}
        assert requests.post(f"{BASE}/plans", json={**wk, "start_date": "2026-02-30"}, headers=t).status_code == 400
        assert requests.post(f"{BASE}/plans", json={**wk, "start_date": D(0), "end_date": "2026-04-31"}, headers=t).status_code == 400
        p = requests.post(f"{BASE}/plans", json={**PLAN, "date": D(1)}, headers=t).json()
        assert requests.put(f"{BASE}/plans/{p['id']}", json={**PLAN, "date": "2026-02-31"}, headers=t).status_code == 400
        assert requests.get(f"{BASE}/occurrences", params={"start": D(0), "end": D(3)}, headers=t).status_code == 200
        requests.delete(f"{BASE}/plans/{p['id']}", headers=t)

    def test_invalid_meeting_dates_400(self, env):
        t = h(env["a"]["token"]); gid = env["g"]["id"]
        assert requests.post(f"{BASE}/groups/{gid}/meetings", json={"date": "2026-02-31", "title": "TEST_m"}, headers=t).status_code == 400
        m = requests.post(f"{BASE}/groups/{gid}/meetings", json={"date": D(2), "title": "TEST_m"}, headers=t).json()
        assert requests.put(f"{BASE}/meetings/{m['id']}", json={"date": "2026-02-31", "title": "TEST_m"}, headers=t).status_code == 400
        assert requests.delete(f"{BASE}/meetings/{m['id']}", headers=t).status_code == 200

    # --- free days: own-group meeting day listed with meeting; other-group meeting day busy
    def test_free_days_meeting_days(self, env):
        a, b, c, g = env["a"], env["b"], env["c"], env["g"]
        ta, tb = h(a["token"]), h(b["token"])
        m = requests.post(f"{BASE}/groups/{g['id']}/meetings", json={"date": D(20), "title": "TEST_fd",
                          "start_time": "18:00"}, headers=ta).json()
        requests.post(f"{BASE}/meetings/{m['id']}/rsvp", json={"status": "yes"}, headers=tb)
        fd = {x["date"]: x for x in requests.get(f"{BASE}/groups/{g['id']}/free-days",
              params={"start": D(19), "end": D(22)}, headers=tb).json()}
        assert D(20) in fd and fd[D(20)]["meeting"] == {"id": m["id"], "title": "TEST_fd"}
        assert fd[D(19)]["meeting"] is None
        # meeting in another group that b attends -> busy for g
        g2 = requests.post(f"{BASE}/groups", json={"name": "TEST_it2_other"}, headers=tb).json()
        env["extra_groups"].append(g2["id"])
        requests.post(f"{BASE}/groups/{g2['id']}/meetings", json={"date": D(21), "title": "TEST_o"}, headers=tb)
        fd = {x["date"] for x in requests.get(f"{BASE}/groups/{g['id']}/free-days",
              params={"start": D(19), "end": D(22)}, headers=tb).json()}
        assert D(21) not in fd
        requests.delete(f"{BASE}/meetings/{m['id']}", headers=ta)

    # --- leave: owner reassign, last member deletes group + meetings
    def test_owner_leave_reassigns_and_last_leave_deletes(self, env):
        a, c = env["a"], env["c"]
        ta, tc = h(a["token"]), h(c["token"])
        g = requests.post(f"{BASE}/groups", json={"name": "TEST_it2_leave"}, headers=ta).json()
        env["extra_groups"].append(g["id"])
        requests.post(f"{BASE}/groups/join", json={"code": g["code"]}, headers=tc)
        m = requests.post(f"{BASE}/groups/{g['id']}/meetings", json={"date": D(3), "title": "TEST_l"}, headers=ta).json()
        assert requests.post(f"{BASE}/groups/{g['id']}/leave", headers=ta).status_code == 200
        gg = requests.get(f"{BASE}/groups/{g['id']}", headers=tc).json()
        assert gg["owner_id"] == c["user"]["id"]
        mem = requests.get(f"{BASE}/groups/{g['id']}/members", headers=tc).json()
        assert [x["is_owner"] for x in mem] == [True]
        assert requests.post(f"{BASE}/groups/{g['id']}/leave", headers=tc).status_code == 200
        adm = h(env["adm"]["token"])
        assert requests.get(f"{BASE}/groups/{g['id']}", headers=adm).status_code == 404
        assert all(x["id"] != g["id"] for x in requests.get(f"{BASE}/admin/groups", headers=adm).json())
        assert requests.get(f"{BASE}/meetings/{m['id']}", headers=adm).status_code in (404, 405)

    def test_admin_remove_member(self, env):
        adm = h(env["adm"]["token"]); b, g = env["b"], env["g"]
        r = requests.delete(f"{BASE}/admin/groups/{g['id']}/members/{b['user']['id']}", headers=adm)
        assert r.status_code == 200
        assert requests.get(f"{BASE}/groups/{g['id']}", headers=h(b["token"])).status_code == 403
        requests.post(f"{BASE}/groups/join", json={"code": g["code"]}, headers=h(b["token"]))

    def test_admin_delete_owner_user_reassigns_owner(self, env):
        """Deleting a group's owner via admin should not leave owner_id dangling / empty group."""
        adm = h(env["adm"]["token"])
        x, y = register(), register()
        g = requests.post(f"{BASE}/groups", json={"name": "TEST_it2_del"}, headers=h(x["token"])).json()
        env["extra_groups"].append(g["id"])
        requests.post(f"{BASE}/groups/join", json={"code": g["code"]}, headers=h(y["token"]))
        requests.delete(f"{BASE}/admin/users/{x['user']['id']}", headers=adm)
        gg = requests.get(f"{BASE}/groups/{g['id']}", headers=h(y["token"])).json()
        requests.delete(f"{BASE}/admin/users/{y['user']['id']}", headers=adm)
        empty = requests.get(f"{BASE}/groups/{g['id']}", headers=adm).status_code
        assert gg["owner_id"] == y["user"]["id"], "owner_id still points to deleted user"
        assert empty == 404, "group with 0 members left after admin deleted last user"
