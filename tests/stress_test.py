import random
import string
import time
from concurrent.futures import ThreadPoolExecutor

import requests

BASE_URL = "http://localhost:8080"
NUM_REQUESTS = 1000
CONCURRENCY = 50


def random_string(length=10):
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def setup_user():
    username = f"stressuser_{random_string()}"
    password = "password123"
    res = requests.post(
        f"{BASE_URL}/users", json={"username": username, "password": password}
    )
    res.raise_for_status()
    token = res.json()["token"]

    cat_payload = {"name": "Stress Category", "emoji": "🔥", "type": "expense"}
    res = requests.post(
        f"{BASE_URL}/categories",
        json=cat_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    cat_id = res.json()["id"]
    print(f"[*] Registering user: {username}")
    return token, cat_id


def make_request(args):
    token, cat_id = args
    headers = {"Authorization": f"Bearer {token}"}
    exp_payload = {
        "name": "Stress Expense",
        "description": "Stress testing",
        "amount": round(random.uniform(10.0, 500.0), 2),
        "category_id": cat_id,
        "spent_on": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    start_time = time.time()
    res = requests.post(f"{BASE_URL}/expenses", json=exp_payload, headers=headers)
    latency = time.time() - start_time
    return res.status_code, latency


def run_stress_test():
    print("Setting up user for stress test...")
    token, cat_id = setup_user()

    print(
        f"Starting stress test: {NUM_REQUESTS} requests with {CONCURRENCY} concurrent threads..."
    )
    start_time = time.time()

    success_count = 0
    error_count = 0
    latencies = []

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        results = executor.map(
            make_request, [(token, cat_id) for _ in range(NUM_REQUESTS)]
        )

        for status, latency in results:
            latencies.append(latency)
            if status == 201:
                success_count += 1
            else:
                error_count += 1

    total_time = time.time() - start_time

    print("\n--- Stress Test Results ---")
    print(f"Total time: {total_time:.2f} seconds")
    print(f"Requests per second: {NUM_REQUESTS / total_time:.2f}")
    print(f"Successful requests: {success_count}")
    print(f"Failed requests: {error_count}")
    print(f"Average latency: {sum(latencies) / len(latencies):.4f} seconds")
    print(f"Max latency: {max(latencies):.4f} seconds")


if __name__ == "__main__":
    run_stress_test()
