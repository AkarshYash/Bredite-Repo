import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path="../backend/.env")

BASE_URL = os.getenv("TEST_API_URL", "http://localhost:3001/api")

# Mock Headers
ADMIN_HEADERS  = {"Authorization": "Bearer mock-admin-token", "Content-Type": "application/json"}
MEMBER_HEADERS = {"Authorization": "Bearer mock-member-token", "Content-Type": "application/json"}
GUEST_HEADERS  = {"Content-Type": "application/json"}

# ── 1. Authentication & Session Test ──────────────────────────────────
def test_signup_and_login_session():
    unique_email = f"pytest_user_{os.getpid()}@example.com"
    password = "SecretPassword123!"

    # Signup
    signup_res = requests.post(f"{BASE_URL}/auth/signup", json={
        "email": unique_email,
        "password": password,
        "name": "Pytest User"
    }, timeout=5)

    assert signup_res.status_code in (200, 201)
    body = signup_res.json()
    assert "user" in body or "message" in body

    # Login
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": unique_email,
        "password": password
    }, timeout=5)

    assert login_res.status_code == 200
    login_body = login_res.json()
    assert "session" in login_body
    assert login_body["session"].get("access_token") is not None

# ── 2. Member Direct Edit Forbidden (HTTP 403) ───────────────────────
def test_member_direct_edit_forbidden():
    payload = {
        "name": "Direct Member Attempt",
        "gmail": "direct_attempt@example.com",
        "visa_type": "H-1B"
    }

    # Direct POST to /api/members by MEMBER
    res_post = requests.post(f"{BASE_URL}/members", json=payload, headers=MEMBER_HEADERS, timeout=5)
    assert res_post.status_code == 403
    assert "Forbidden" in res_post.json().get("error", "")

    # Direct PUT to /api/members/1 by MEMBER
    res_put = requests.put(f"{BASE_URL}/members/1", json=payload, headers=MEMBER_HEADERS, timeout=5)
    assert res_put.status_code == 403

    # Direct DELETE to /api/members/1 by MEMBER
    res_del = requests.delete(f"{BASE_URL}/members/1", headers=MEMBER_HEADERS, timeout=5)
    assert res_del.status_code == 403

# ── 3. Member Can Submit Pending Change Proposal ──────────────────────
def test_member_can_submit_pending_change():
    proposal = {
        "change_type": "create",
        "payload": {
            "name": "Proposed Consultant",
            "gmail": "proposed@example.com",
            "last_company": "Innovative Tech Inc",
            "tech_stack": "Python, React, AWS"
        }
    }

    res = requests.post(f"{BASE_URL}/pending-changes", json=proposal, headers=MEMBER_HEADERS, timeout=5)
    assert res.status_code == 201
    data = res.json().get("data", {})
    assert data.get("status") == "pending"
    assert data.get("change_type") == "create"
    assert data.get("id") is not None

# ── 4. Admin Approve & Reject Pending Change ──────────────────────────
def test_admin_approve_and_reject_change():
    # 1. Member submits update proposal for member #1
    proposal = {
        "change_type": "update",
        "target_member_id": 1,
        "payload": {
            "name": "Nirav Patel (Updated via Admin Approval)",
            "gmail": "Niravp1216@gmail.com"
        }
    }
    submit_res = requests.post(f"{BASE_URL}/pending-changes", json=proposal, headers=MEMBER_HEADERS, timeout=5)
    assert submit_res.status_code == 201
    pending_id = submit_res.json()["data"]["id"]

    # 2. Admin approves change
    approve_res = requests.post(f"{BASE_URL}/pending-changes/{pending_id}/approve", json={"admin_note": "Verified"}, headers=ADMIN_HEADERS, timeout=5)
    assert approve_res.status_code == 200
    assert approve_res.json()["data"]["status"] == "approved"

    # 3. Verify change reflected in /api/members/1
    member_res = requests.get(f"{BASE_URL}/members/1", timeout=5)
    assert member_res.status_code == 200
    updated_name = member_res.json()["data"]["name"]
    assert "Updated via Admin Approval" in updated_name

# ── 5. Audit Log Records Actions ─────────────────────────────────────
def test_audit_log_records_actions():
    # Admin performs a direct edit
    direct_edit = {
        "name": "Nirav Patel",
        "gmail": "Niravp1216@gmail.com",
        "last_company": "Centene Corporation"
    }
    requests.put(f"{BASE_URL}/members/1", json=direct_edit, headers=ADMIN_HEADERS, timeout=5)

    # Admin fetches audit log
    audit_res = requests.get(f"{BASE_URL}/audit-log", headers=ADMIN_HEADERS, timeout=5)
    assert audit_res.status_code == 200
    log_items = audit_res.json().get("data", [])
    assert len(log_items) > 0
    assert any(item.get("action_type") in ("update_member", "approve_change", "system_init") for item in log_items)

# ── 6. Non-Admin Forbidden from Audit Log & User Management (HTTP 403) ─
def test_non_admin_cannot_access_audit_log_or_users():
    # MEMBER accessing /api/audit-log
    res_audit = requests.get(f"{BASE_URL}/audit-log", headers=MEMBER_HEADERS, timeout=5)
    assert res_audit.status_code == 403

    # GUEST accessing /api/audit-log
    res_audit_guest = requests.get(f"{BASE_URL}/audit-log", headers=GUEST_HEADERS, timeout=5)
    assert res_audit_guest.status_code in (401, 403)

    # MEMBER accessing /api/users
    res_users = requests.get(f"{BASE_URL}/users", headers=MEMBER_HEADERS, timeout=5)
    assert res_users.status_code == 403

# ── 7. User Registration Approval Workflow ─────────────────────────────
def test_user_registration_approval_workflow():
    new_user_email = f"pending_user_{os.getpid()}@example.com"
    password = "TestPassword123!"

    # 1. Register new user
    signup_res = requests.post(f"{BASE_URL}/auth/signup", json={
        "email": new_user_email,
        "password": password,
        "name": "Pending Approval User"
    }, timeout=5)

    assert signup_res.status_code == 201
    profile = signup_res.json().get("profile", {})
    user_id = profile.get("id")
    assert profile.get("role") == "PENDING"

    # 2. Admin views users list
    users_res = requests.get(f"{BASE_URL}/users", headers=ADMIN_HEADERS, timeout=5)
    assert users_res.status_code == 200
    user_list = users_res.json().get("data", [])
    assert any(u.get("email") == new_user_email for u in user_list)

    # 3. Admin approves user registration as MEMBER
    approve_res = requests.put(f"{BASE_URL}/users/{user_id}/role", json={"role": "MEMBER"}, headers=ADMIN_HEADERS, timeout=5)
    assert approve_res.status_code == 200
    assert approve_res.json()["data"]["role"] == "MEMBER"

# ── 8. Google Authentication Endpoint ─────────────────────────────────
def test_google_auth_endpoint():
    google_email = f"google_user_{os.getpid()}@example.com"
    res = requests.post(f"{BASE_URL}/auth/google", json={
        "email": google_email,
        "name": "Google Test User"
    }, timeout=5)

    assert res.status_code == 200
    data = res.json()
    assert "session" in data
    assert "profile" in data
    assert data["profile"]["email"] == google_email

if __name__ == "__main__":
    pytest.main(["-v", __file__])
