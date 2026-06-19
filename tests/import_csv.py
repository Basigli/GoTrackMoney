import csv
import sys
import requests
from datetime import datetime

API_BASE = 'http://localhost:8080'

def main():
    if len(sys.argv) < 2:
        print("Usage: python import_csv.py <path_to_csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    
    username = "Anna"
    password = "AnnaSecurePassword!2026"
    
    # 1. Register or Login
    print(f"[*] Attempting to login/register user: {username}")
    token = None
    
    # Try to login first
    login_res = requests.post(f"{API_BASE}/auth/login", json={
        "username": username,
        "password": password
    })
    
    if login_res.status_code == 200:
        token = login_res.json().get('token')
        print("[*] Successfully logged in.")
    else:
        # Register
        reg_res = requests.post(f"{API_BASE}/users", json={
            "username": username,
            "password": password
        })
        if reg_res.status_code == 201:
            token = reg_res.json().get('token')
            print("[*] Successfully registered new user.")
        else:
            print(f"[!] Failed to register: {reg_res.text}")
            sys.exit(1)
            
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Fetch existing categories
    cat_res = requests.get(f"{API_BASE}/categories", headers=headers)
    cat_res.raise_for_status()
    categories = cat_res.json()
    
    if categories is None:
        categories = []
        
    category_map = {c['name'].lower(): (c['id'], c['type']) for c in categories}
    
    # 3. Process CSV
    print(f"[*] Reading CSV file: {csv_path}")
    count = 0
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        # Determine if income based on the presence of 'userId' column
        is_income = 'userId' in reader.fieldnames if reader.fieldnames else False
        record_type = "income" if is_income else "expense"
        print(f"[*] Detected record type: {record_type}")

        for row in reader:
            cat_name = row.get('category', '').strip()
            amount_str = row.get('amount', '0')
            date_str = row.get('period', '')
            desc = row.get('description', '').strip()
            
            if not cat_name:
                continue
                
            try:
                amount = float(amount_str)
            except ValueError:
                amount = 0.0
            
            # Format date: "2023-06-01 16:54:01" -> "2023-06-01T16:54:01Z"
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                iso_date = dt.isoformat() + "Z"
            except ValueError:
                iso_date = datetime.now().isoformat() + "Z"
                
            # Create category if not exists
            cat_lower = cat_name.lower()
            if cat_lower not in category_map or category_map[cat_lower][1] != record_type:
                print(f"[*] Creating new {record_type} category: {cat_name}")
                new_cat_res = requests.post(f"{API_BASE}/categories", json={
                    "name": cat_name,
                    "type": record_type,
                    "emoji": "💰" if is_income else "📁"
                }, headers=headers)
                
                if new_cat_res.status_code == 201:
                    cat_id = new_cat_res.json()['id']
                    category_map[cat_lower] = (cat_id, record_type)
                else:
                    print(f"[!] Failed to create category {cat_name}: {new_cat_res.text}")
                    continue
            
            cat_id = category_map[cat_lower][0]
            
            # Create record
            if is_income:
                payload = {
                    "name": cat_name,
                    "description": desc,
                    "amount": amount,
                    "category_id": cat_id,
                    "received_on": iso_date
                }
                endpoint = "/incomes"
            else:
                payload = {
                    "name": cat_name,
                    "description": desc,
                    "amount": amount,
                    "category_id": cat_id,
                    "spent_on": iso_date
                }
                endpoint = "/expenses"

            res = requests.post(f"{API_BASE}{endpoint}", json=payload, headers=headers)
            
            if res.status_code == 201:
                count += 1
            else:
                print(f"[!] Failed to create {record_type} ({desc}): {res.text}")
                
    print(f"[*] Porting complete. Successfully imported {count} {record_type}s.")
    print("--------------------------------------------------")
    print("Credentials for the imported user:")
    print(f"Username: {username}")
    print(f"Password: {password}")
    print("--------------------------------------------------")

if __name__ == "__main__":
    main()
