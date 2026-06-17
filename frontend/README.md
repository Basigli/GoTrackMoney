# GoTrackMoney Frontend

This is the frontend application for **GoTrackMoney**, built with [Next.js](https://nextjs.org). It provides a responsive, beautiful UI to manage your finances, incomes, and expenses.

## Features

- **Dashboard**: Get an overview of your total balance, expenses, and incomes.
- **Categories Management**: Create custom categories with specific emojis to better organize your transactions.
- **Periodic Expenses**: Schedule recurring expenses (e.g., daily, weekly, monthly, yearly) and the system will automatically generate them when they are due!
- **Internationalization (i18n)**: Fully localized in both English and Italian. Switch seamlessly using the navigation bar.

## Getting Started

First, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Running Tests (Python Environment)

We provide comprehensive End-to-End (E2E) and Stress tests written in Python to ensure the entire application works flawlessly under different conditions. The test scripts are located in the `tests/` directory at the root of the repository.

### Prerequisites
Make sure you have Python 3 installed. It is recommended to use a Python virtual environment to isolate the test dependencies.

1. **Create a virtual environment**:
   ```bash
   python -m venv venv
   ```

2. **Activate the virtual environment**:
   - On **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```
   - On **Windows**:
     ```bash
     .\venv\Scripts\activate
     ```

3. **Install the required dependencies**:
   ```bash
   pip install requests
   ```

*(Note: Ensure your Go backend server is running on `localhost:8080` before executing these tests!)*

### End-to-End (E2E) Test
This script runs a complete user journey against the live API: registering a user, logging in, creating categories, creating standard expenses, and creating periodic expenses to ensure the generation logic works.

Run this from the root of the project:
```bash
python tests/e2e_test.py
```

### Stress Test
This script blasts the backend API with 1,000 requests using 50 concurrent threads to measure latency and verify the system's stability under heavy load.

Run this from the root of the project:
```bash
python tests/stress_test.py
```
