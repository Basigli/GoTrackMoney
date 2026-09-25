"""Populate a new demo account with realistic income and expense history."""

import argparse
import os
import secrets
import sys
from functools import partial
import urllib.request
import urllib.error
import urllib.parse
import json
import random
import string
import datetime

API_BASE = os.environ.get('API_BASE_URL', 'http://localhost:8098')

def rand_string(length=8):
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(length))

def request(method, path, payload=None, token=None, *, api_base=API_BASE):
    url = f"{api_base.rstrip('/')}{path}"
    headers = {}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='replace').strip()
        raise RuntimeError(f"{method} {url}: HTTP {e.code}: {detail}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise RuntimeError(f"{method} {url}: {e}. Check that the backend is running.") from e
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise RuntimeError(f"{method} {url}: expected a JSON response.") from e


def positive_days(value):
    days = int(value)
    if days < 1:
        raise argparse.ArgumentTypeError("days must be at least 1")
    return days


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-url', default=API_BASE,
                        help='Backend URL (default: API_BASE_URL or http://localhost:8098)')
    parser.add_argument('--days', type=positive_days, default=730,
                        help='Number of calendar days, including today (default: 730)')
    parser.add_argument('--seed', type=int, help='Optional seed for reproducible transaction amounts')
    args = parser.parse_args(argv)
    if urllib.parse.urlparse(args.api_url).scheme not in ('http', 'https'):
        parser.error('--api-url must be an http:// or https:// URL')
    api_request = partial(request, api_base=args.api_url)
    random.seed(args.seed)
    username = f"testuser_{rand_string()}"
    password = rand_string(12)

    print("====================================")
    print(f"API: {args.api_url}")
    print("Creating user...")
    print(f"Username: {username}")
    print(f"Password: {password}")
    print("====================================")

    # 1. Register User
    res = api_request('POST', '/users', {"username": username, "password": password})
    token = res.get('token')
    if not token:
        raise RuntimeError("Registration did not return a token; no transactions were created.")

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
        c_res = api_request('POST', '/categories', c, token)
        categories[c['name']] = c_res['id']

    print(f"Generating data over the last {args.days} days...")

    end_date = datetime.datetime.now(datetime.timezone.utc)
    start_date = end_date - datetime.timedelta(days=args.days - 1)

    curr_date = start_date

    records_added = 0

    while curr_date <= end_date:
        # Monthly things (on the 1st of the month)
        if curr_date.day == 1:
            # Salary
            api_request('POST', '/incomes', {
                "name": "Stipendio Mensile",
                "description": "Tech Corp",
                "amount": round(random.uniform(2800, 3200), 2),
                "category_id": categories["Stipendio"],
                "received_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            }, token)

            # Rent
            api_request('POST', '/expenses', {
                "name": "Affitto Mensile",
                "description": "",
                "amount": 1000.0,
                "category_id": categories["Affitto"],
                "spent_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            }, token)

            records_added += 2

            # Maybe freelance income
            if random.random() < 0.3:
                api_request('POST', '/incomes', {
                    "name": "Progetto Web",
                    "description": "Cliente",
                    "amount": round(random.uniform(300, 1000), 2),
                    "category_id": categories["Freelance"],
                    "received_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
                }, token)
                records_added += 1

        # Mid-month utilities (on the 15th)
        if curr_date.day == 15:
            api_request('POST', '/expenses', {
                "name": "Bolletta Elettricità/Gas",
                "description": "",
                "amount": round(random.uniform(80, 180), 2),
                "category_id": categories["Bollette"],
                "spent_on": curr_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            }, token)
            records_added += 1

        # Weekly groceries (e.g. Saturdays)
        if curr_date.weekday() == 5:
            api_request('POST', '/expenses', {
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

            api_request('POST', '/expenses', {
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
    try:
        main()
    except (RuntimeError, KeyError, TypeError) as error:
        print(f"Generation failed: {error}", file=sys.stderr)
        print("The account may be partially populated; rerunning creates a new account.", file=sys.stderr)
        sys.exit(1)
