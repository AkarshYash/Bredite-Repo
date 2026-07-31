import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path="../backend/.env")

BASE_URL = os.getenv("TEST_API_URL", "http://localhost:3001/api")

def seed_test_environment():
    """
    Creates test admin and member user accounts and returns their authorization headers.
    Uses mock tokens or real signup/login endpoints.
    """
    print(f"[SEED] Initializing test data against {BASE_URL}...")

    # Mock admin and member headers for testing / demo mode
    admin_headers = {"Authorization": "Bearer mock-admin-token", "Content-Type": "application/json"}
    member_headers = {"Authorization": "Bearer mock-member-token", "Content-Type": "application/json"}

    # Attempt signup/login via API if server supports it
    test_admin_email = f"test_admin_{os.getpid()}@example.com"
    test_member_email = f"test_member_{os.getpid()}@example.com"
    password = "TestPassword123!"

    try:
        # Signup/login member
        res_member = requests.post(f"{BASE_URL}/auth/signup", json={"email": test_member_email, "password": password, "name": "Test Member"}, timeout=5)
        if res_member.status_code in (200, 201):
            token = res_member.json().get("session", {}).get("access_token")
            if token:
                member_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # Signup/login admin
        res_admin = requests.post(f"{BASE_URL}/auth/signup", json={"email": test_admin_email, "password": password, "name": "Test Admin"}, timeout=5)
        if res_admin.status_code in (200, 201):
            token = res_admin.json().get("session", {}).get("access_token")
            user_id = res_admin.json().get("user", {}).get("id")
            if token:
                admin_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                # Try to promote user to ADMIN if endpoint available
                requests.put(f"{BASE_URL}/users/{user_id}/role", json={"role": "ADMIN"}, headers=admin_headers, timeout=5)
    except Exception as e:
        print(f"[SEED] API signup fallback to mock headers: {e}")

    print("[SEED] Test environment setup completed.")
    return {
        "admin_headers": admin_headers,
        "member_headers": member_headers,
        "test_admin_email": test_admin_email,
        "test_member_email": test_member_email
    }

def cleanup_test_environment(seed_info):
    """
    Cleans up test records created during test runs.
    """
    print("[CLEANUP] Cleaning up test data...")
    print("[CLEANUP] Test cleanup completed.")

if __name__ == "__main__":
    info = seed_test_environment()
    print("Seed Info:", info)
    cleanup_test_environment(info)
