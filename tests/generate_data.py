import urllib.request
import urllib.error
import json
import random
import string
import datetime

API_BASE = 'http://localhost:8080'

def rand_string(length=8):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def request(method, path, payload=None, token=None):
    url = f"{API_BASE}{path}"
    headers = {}
    data = None
    if payload:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.read().decode('utf-8')}")
        raise

def main():
    username = f"testuser_{rand_string()}"
    password = rand_string(12)
    
    print("====================================")
    print(f"Creating User...")
    print(f"Username: {username}")
    print(f"Password: {password}")
    print("====================================")
    
    # 1. Register User
    res = request('POST', '/users', {"username": username, "password": password})
    token = res.get('token')
    if not token:
        print("Failed to get token!")
        return

    # 2. Create Categories
    category_defs = [
        {"name": "Stipendio", "emoji": "💰", "type": "income"},
        {"name": "Freelance", "emoji": "💻", "type": "income"},
        {"name": "Affitto", "emoji": "🏠", "type": "expense"},
        {"name": "Spesa", "emoji": "🛒", "type": "expense"},
        {"name": "Bollette", "emoji": "⚡", "type": "expense"},
        {"name": "Intrattenimento", "emoji": "🎬", "type": "expense"},
        {"name": "Trasporti", "emoji": "🚗", "type": "expense"},
        {"name": "Salute", "emoji": "💊", "type": "expense"},
        {"name": "Ristorante", "emoji": "🍕", "type": "expense"}
    ]
    
    categories = {}
    print("Creating categories...")
    for c in category_defs:
        c_res = request('POST', '/categories', c, token)
        categories[c['name']] = c_res['id']
        
    print("Generating data over the last 2 years...")
    
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=730)
    
    curr_date = start_date
    
    records_added = 0
    
    while curr_date <= end_date:
        # Monthly things (on the 1st of the month)
        if curr_date.day == 1:
            # Salary
            request('POST', '/incomes', {
                "name": "Stipendio Mensile",
                "description": "Tech Corp",
                "amount": round(random.uniform(2800, 3200), 2),
                "category_id": categories["Stipendio"],
                "received_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            }, token)
            
            # Rent
            request('POST', '/expenses', {
                "name": "Affitto Mensile",
                "description": "",
                "amount": 1000.0,
                "category_id": categories["Affitto"],
                "spent_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            }, token)
            
            records_added += 2
            
            # Maybe freelance income
            if random.random() < 0.3:
                request('POST', '/incomes', {
                    "name": "Progetto Web",
                    "description": "Cliente",
                    "amount": round(random.uniform(300, 1000), 2),
                    "category_id": categories["Freelance"],
                    "received_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
                }, token)
                records_added += 1

        # Mid-month utilities (on the 15th)
        if curr_date.day == 15:
            request('POST', '/expenses', {
                "name": "Bolletta Elettricità/Gas",
                "description": "",
                "amount": round(random.uniform(80, 180), 2),
                "category_id": categories["Bollette"],
                "spent_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            }, token)
            records_added += 1

        # Weekly groceries (e.g. Saturdays)
        if curr_date.weekday() == 5:
            request('POST', '/expenses', {
                "name": "Spesa al Supermercato",
                "description": "Esselunga",
                "amount": round(random.uniform(50, 150), 2),
                "category_id": categories["Spesa"],
                "spent_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            }, token)
            records_added += 1
            
        # Daily random expenses (coffee, transport, restaurant)
        if random.random() < 0.6: # 60% chance of spending money on a day
            cat_opts = ["Trasporti", "Intrattenimento", "Ristorante", "Salute"]
            weights = [0.4, 0.2, 0.3, 0.1]
            chosen_cat = random.choices(cat_opts, weights=weights, k=1)[0]
            
            amt = 0
            if chosen_cat == "Trasporti":
                amt = round(random.uniform(2, 30), 2)
                desc = "Benzina o Treno"
            elif chosen_cat == "Ristorante":
                amt = round(random.uniform(15, 60), 2)
                desc = "Cena fuori"
            elif chosen_cat == "Intrattenimento":
                amt = round(random.uniform(10, 50), 2)
                desc = "Cinema / Evento"
            else:
                amt = round(random.uniform(10, 100), 2)
                desc = "Farmacia"
                
            request('POST', '/expenses', {
                "name": f"Spesa {chosen_cat}",
                "description": desc,
                "amount": amt,
                "category_id": categories[chosen_cat],
                "spent_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            }, token)
            records_added += 1

        curr_date += datetime.timedelta(days=1)
        
        # print progress
        if curr_date.day == 1:
            print(f"Processed up to {curr_date.strftime('%Y-%m')}... ({records_added} records)")

    print("====================================")
    print("DONE! You can now log in with:")
    print(f"Username: {username}")
    print(f"Password: {password}")
    print(f"Total records added: {records_added}")
    print("====================================")

if __name__ == '__main__':
    main()
