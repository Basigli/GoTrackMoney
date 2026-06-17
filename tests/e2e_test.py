import requests
import string
import random
import time

BASE_URL = "http://localhost:8080"

def random_string(length=10):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def run_e2e():
    print("Starting E2E Tests...")
    
    # 1. Register
    username = f"testuser_{random_string()}"
    password = "password123"
    print(f"[*] Registering user: {username}")
    res = requests.post(f"{BASE_URL}/users", json={"username": username, "password": password})
    assert res.status_code == 201, f"Failed to register: {res.text}"
    token = res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Login
    print("[*] Logging in...")
    res = requests.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Failed to login: {res.text}"
    
    # 3. Create Category
    print("[*] Creating category...")
    cat_payload = {"name": "Test Category", "emoji": "🚀", "type": "expense"}
    res = requests.post(f"{BASE_URL}/categories", json=cat_payload, headers=headers)
    assert res.status_code == 201, f"Failed to create category: {res.text}"
    cat_id = res.json()["id"]
    
    # 4. Create Normal Expense
    print("[*] Creating standard expense...")
    exp_payload = {
        "name": "Standard Expense",
        "description": "Just testing",
        "amount": 150.50,
        "category_id": cat_id,
        "spent_on": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }
    res = requests.post(f"{BASE_URL}/expenses", json=exp_payload, headers=headers)
    assert res.status_code == 201, f"Failed to create expense: {res.text}"
    
    # 5. Create Periodic Expense
    print("[*] Creating periodic expense...")
    p_exp_payload = {
        "name": "Periodic Expense",
        "description": "Monthly recurring",
        "amount": 50.00,
        "category_id": cat_id,
        "period_interval": 1,
        "period_unit": "months",
        "start_date": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }
    res = requests.post(f"{BASE_URL}/periodic-expenses", json=p_exp_payload, headers=headers)
    assert res.status_code == 201, f"Failed to create periodic expense: {res.text}"
    
    # 6. Fetch Expenses (This triggers generation of due periodic expenses!)
    print("[*] Fetching expenses to trigger periodic generation...")
    res = requests.get(f"{BASE_URL}/expenses", headers=headers)
    assert res.status_code == 200, f"Failed to fetch expenses: {res.text}"
    expenses = res.json()
    
    # We should have 2 expenses now: the normal one, and the one generated from the periodic expense
    assert len(expenses) >= 2, f"Expected at least 2 expenses, got {len(expenses)}"
    print("[*] Found expenses:")
    for e in expenses:
        print(f"    - {e['name']}: {e['amount']}")
        
    print("✅ E2E Tests completed successfully!")

if __name__ == "__main__":
    run_e2e()
