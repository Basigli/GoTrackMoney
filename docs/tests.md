# Testing Guide

GoTrackMoney is built with reliability in mind. This guide explains how to run the automated unit tests and how to generate realistic mock data for manual testing and UI development.

## 1. Backend Unit Tests

The Go backend includes comprehensive unit tests to ensure that routing, authentication, and database logic perform as expected.

To run the backend test suite, navigate to the `backend` directory and use the standard Go test command:

```bash
cd backend
go test ./...
```

You should see output indicating that all packages passed:
```
?       github.com/gabri/GoTrackMoney/cmd    [no test files]
ok      github.com/gabri/GoTrackMoney/internal/ledger    0.424s
```

## 2. Generating Mock Data for UI Testing

If you are developing or testing the frontend, having a realistic set of data (incomes, expenses, categories) is crucial to see how the charts and dashboard will look.

Instead of manually typing in dozens of transactions, you can use the included Python script to instantly populate the database with up to 2 years' worth of randomized transactions.

**Prerequisites:**
Make sure your backend and database containers are currently running via Docker Compose.

**Run the generator:**
```bash
python3 tests/generate_data.py
```

**What the script does:**
1. Connects to your running local backend via API.
2. Creates a completely new user account.
3. Automatically sets up realistic categories (e.g., Groceries, Rent, Salary).
4. Inserts hundreds of randomized expenses and incomes over a 2-year timeline.
5. Prints out the newly generated **Username** and **Password** in your terminal.

You can then log into the web interface using those credentials and immediately explore a fully populated version of GoTrackMoney!
