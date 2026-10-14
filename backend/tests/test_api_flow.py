from io import BytesIO

from openpyxl import load_workbook

from tests.conftest import API

FORM = {
    "title": "Job Application",
    "description": "Apply for an open role",
    "is_public": True,
    "allow_response_edit": True,
    "fields": [
        {"label": "Full Name", "field_type": "text", "is_required": True, "config": {"min_length": 2}},
        {"label": "Email", "field_type": "email", "is_required": True},
        {"label": "Years of experience", "field_key": "experience", "field_type": "number", "config": {"min": 0, "max": 50}},
        {"label": "Currently employed?", "field_key": "employed", "field_type": "radio", "is_required": True,
         "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]},
        {"label": "Current company", "field_key": "company", "field_type": "text", "is_required": True,
         "visibility_rules": {"logic": "all", "conditions": [{"field_key": "employed", "operator": "equals", "value": "yes"}]}},
        {"label": "Department", "field_type": "dropdown", "options": [{"label": "Engineering"}, {"label": "Sales"}]},
        {"label": "Skills", "field_type": "checkbox", "options": [{"label": "Python"}, {"label": "SQL"}, {"label": "React"}]},
        {"label": "Start date", "field_key": "start_date", "field_type": "date"},
        {"label": "Resume", "field_key": "resume", "field_type": "file", "config": {"allowed_extensions": ["pdf"], "max_size_mb": 2}},
        {"label": "Rate our process", "field_key": "rating", "field_type": "rating", "config": {"max_rating": 5}},
        {"label": "I agree to the terms", "field_key": "agree", "field_type": "checkbox", "is_required": True},
    ],
}


def test_auth_and_rbac(client, user_headers, admin_headers):
    r = client.get(f"{API}/auth/me", headers=user_headers)
    assert r.json()["role"] == "User"
    assert client.get(f"{API}/users", headers=user_headers).status_code == 403
    assert client.get(f"{API}/users", headers=admin_headers).json()["total"] >= 2
    assert client.get(f"{API}/forms").status_code == 401
    dup = client.post(f"{API}/auth/register", json={"full_name": "X Y", "email": "owner@formbuilder.com", "password": "Password@123"})
    assert dup.status_code == 409


def test_full_flow(client, user_headers, other_headers, admin_headers):
    # ---- create form
    r = client.post(f"{API}/forms", json=FORM, headers=user_headers)
    assert r.status_code == 201, r.text
    form = r.json()
    form_id, slug = form["id"], form["slug"]
    keys = [f["field_key"] for f in form["fields"]]
    assert keys[:2] == ["full_name", "email"] and form["field_count"] == 11

    # other user cannot manage it
    assert client.get(f"{API}/forms/{form_id}", headers=other_headers).status_code == 403

    # ---- invalid definition (unknown condition reference)
    bad = client.post(f"{API}/forms/{form_id}/fields", headers=user_headers, json={
        "label": "X", "field_type": "text", "visibility_rules": {"conditions": [{"field_key": "nope", "operator": "is_empty"}]}})
    assert bad.status_code == 422 and "unknown field" in bad.json()["errors"][0]

    # ---- public render + file upload + anonymous submission
    assert client.get(f"{API}/public/forms/{slug}").status_code == 200
    up = client.post(f"{API}/public/forms/{slug}/upload", params={"field_key": "resume"},
                     files={"file": ("cv.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert up.status_code == 201, up.text
    bad_up = client.post(f"{API}/public/forms/{slug}/upload", params={"field_key": "resume"},
                         files={"file": ("cv.exe", b"MZ", "application/octet-stream")})
    assert bad_up.status_code == 422

    invalid = client.post(f"{API}/public/forms/{slug}/submit", json={"answers": {"full_name": "A", "employed": "yes"}})
    assert invalid.status_code == 422
    assert set(invalid.json()["errors"]) >= {"full_name", "email", "company", "agree"}

    anon = client.post(f"{API}/public/forms/{slug}/submit", json={"answers": {
        "full_name": "Anon Applicant", "email": "anon@mail.com", "employed": "no", "company": "hidden-ignored",
        "department": "Sales", "skills": ["SQL"], "resume": up.json()["file_path"], "rating": 3, "agree": True}})
    assert anon.status_code == 201, anon.text

    # ---- authenticated submission by another user
    auth = client.post(f"{API}/public/forms/{slug}/submit", headers=other_headers, json={"answers": {
        "full_name": "Other Applicant", "email": "other@mail.com", "experience": 5, "employed": "yes",
        "company": "Acme", "department": "Engineering", "skills": ["Python", "React"], "start_date": "2026-11-01",
        "rating": 5, "agree": True}})
    assert auth.status_code == 201, auth.text
    rid = auth.json()["response_id"]

    # ---- list / search / filter
    lst = client.get(f"{API}/forms/{form_id}/responses", headers=user_headers).json()
    assert lst["total"] == 2
    assert client.get(f"{API}/forms/{form_id}/responses", params={"search": "acme"}, headers=user_headers).json()["total"] == 1
    assert client.get(f"{API}/forms/{form_id}/responses", params={"submitter_type": "anonymous"}, headers=user_headers).json()["total"] == 1
    flt = client.get(f"{API}/forms/{form_id}/responses", params={"field_key": "department", "field_value": "Engineering"}, headers=user_headers)
    assert flt.json()["total"] == 1

    # ---- submitter edits own response (allowed by form), history recorded
    current = client.get(f"{API}/responses/{rid}", headers=other_headers).json()
    assert current["can_edit"] is True and current["can_delete"] is False
    answers = current["answers"] | {"company": "Globex", "rating": 4}
    upd = client.put(f"{API}/responses/{rid}", json={"answers": answers}, headers=other_headers)
    assert upd.status_code == 200 and upd.json()["version"] == 2
    hist = client.get(f"{API}/responses/{rid}/history", headers=user_headers).json()
    assert [h["action"] for h in hist] == ["RESPONSE_SUBMITTED", "RESPONSE_UPDATED"]
    assert hist[1]["old_values"]["company"] == "Acme" and hist[1]["new_values"]["company"] == "Globex"

    # ---- disable form: submissions & submitter edits blocked, owner can still edit
    client.patch(f"{API}/forms/{form_id}/status", json={"is_active": False}, headers=user_headers)
    assert client.post(f"{API}/public/forms/{slug}/submit", json={"answers": {}}).status_code == 403
    assert client.put(f"{API}/responses/{rid}", json={"answers": answers}, headers=other_headers).status_code == 403
    assert client.put(f"{API}/responses/{rid}", json={"answers": answers | {"rating": 2}}, headers=user_headers).status_code == 200
    client.patch(f"{API}/forms/{form_id}/status", json={"is_active": True}, headers=user_headers)

    # ---- builder: reorder + rename key + delete field (answers keep snapshot)
    detail = client.get(f"{API}/forms/{form_id}", headers=user_headers).json()
    ids = [f["id"] for f in detail["fields"]]
    r = client.put(f"{API}/forms/{form_id}/fields/reorder", json={"field_ids": list(reversed(ids))}, headers=user_headers)
    assert r.status_code == 200 and r.json()["fields"][0]["field_key"] == "agree"
    dept = next(f for f in detail["fields"] if f["field_key"] == "department")
    r = client.delete(f"{API}/forms/{form_id}/fields/{dept['id']}", headers=user_headers)
    assert r.status_code == 200 and r.json()["field_count"] == 10
    still = client.get(f"{API}/responses/{rid}", headers=user_headers).json()
    assert still["answers"]["department"] == "Engineering"

    # ---- analytics
    fa = client.get(f"{API}/analytics/forms/{form_id}", headers=user_headers).json()
    assert fa["total_responses"] == 2 and fa["anonymous_responses"] == 1 and fa["edited_responses"] == 1
    skills = next(f for f in fa["fields"] if f["field_key"] == "skills")
    assert {o["label"]: o["count"] for o in skills["option_counts"]} == {"Python": 1, "SQL": 1, "React": 1}
    dash = client.get(f"{API}/analytics/dashboard", headers=admin_headers).json()
    assert dash["total_responses"] >= 2 and dash["total_users"] >= 3 and len(dash["submissions_trend"]) == 30

    # ---- exports (synchronous)
    xl = client.get(f"{API}/exports/forms/{form_id}/download", params={"format": "excel"}, headers=user_headers)
    assert xl.status_code == 200
    wb = load_workbook(BytesIO(xl.content))
    assert wb["Responses"].max_row == 3 and "Summary" in wb.sheetnames
    pdf = client.get(f"{API}/exports/forms/{form_id}/download", params={"format": "pdf", "search": "Globex"}, headers=user_headers)
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"

    # ---- file download & delete permissions
    anon_resp = next(i for i in lst["items"] if i["submitted_by"] is None)
    file_detail = next(d for d in anon_resp["details"] if d["field_type"] == "file")
    dl = client.get(f"{API}/responses/{anon_resp['id']}/files/{file_detail['id']}", headers=user_headers)
    assert dl.status_code == 200 and dl.content.startswith(b"%PDF")
    assert client.delete(f"{API}/responses/{rid}", headers=other_headers).status_code == 403
    assert client.delete(f"{API}/responses/{rid}", headers=admin_headers).status_code == 200

    # ---- activity logs
    logs = client.get(f"{API}/activity-logs", params={"entity_type": "form"}, headers=admin_headers).json()
    actions = {i["action"] for i in logs["items"]}
    assert {"FORM_CREATED", "FORM_DISABLED", "FORM_FIELDS_UPDATED"} <= actions
    own = client.get(f"{API}/activity-logs", headers=other_headers).json()
    assert all(i["user_id"] == own["items"][0]["user_id"] for i in own["items"])
    assert client.get(f"{API}/forms/{form_id}/activity", headers=user_headers).json()["total"] > 0

    # ---- duplicate & delete
    dup = client.post(f"{API}/forms/{form_id}/duplicate", headers=user_headers)
    assert dup.status_code == 201 and dup.json()["is_active"] is False and dup.json()["field_count"] == 10
    assert client.delete(f"{API}/forms/{dup.json()['id']}", headers=user_headers).status_code == 200


def test_private_form_requires_login(client, user_headers, other_headers):
    form = client.post(f"{API}/forms", headers=user_headers, json={
        "title": "Internal survey", "is_public": False, "allow_multiple_submissions": False,
        "fields": [{"label": "Feedback", "field_type": "text", "is_required": True}]}).json()
    slug = form["slug"]
    assert client.get(f"{API}/public/forms/{slug}").status_code == 401
    ok = client.post(f"{API}/public/forms/{slug}/submit", headers=other_headers, json={"answers": {"feedback": "Great"}})
    assert ok.status_code == 201
    again = client.post(f"{API}/public/forms/{slug}/submit", headers=other_headers, json={"answers": {"feedback": "Again"}})
    assert again.status_code == 409
    mine = client.get(f"{API}/responses/mine", headers=other_headers).json()
    assert any(i["form_id"] == form["id"] for i in mine["items"])
    # editing not allowed by form settings
    rid = ok.json()["response_id"]
    assert client.put(f"{API}/responses/{rid}", headers=other_headers, json={"answers": {"feedback": "x"}}).status_code == 403
