# Data Porting Guide

This document outlines the steps required to export your financial data (incomes and expenses) from the old system and import them into the new GoTrackMoney application.

## Step 1: Export Data from the Old System

Run the following script in your old system (e.g. Ignition / Jython environment) to export both `expenses` and `incomes` tables into CSV files. The script will save two files on your Desktop.

```python
# --- Export Expenses ---
query = """
	SELECT * FROM expenses
"""

data = system.db.runPrepQuery(query)

csv_data = system.dataset.toCSV(data)
filepath = "/Users/gabri/Desktop/expenses_old_data.csv"
print csv_data

system.file.writeFile(filepath, csv_data)

# --- Export Incomes ---
query = """
	SELECT * FROM incomes
"""

data = system.db.runPrepQuery(query)

csv_data = system.dataset.toCSV(data)
filepath = "/Users/gabri/Desktop/incomes_old_data.csv"
print csv_data

system.file.writeFile(filepath, csv_data)
```

## Step 2: Prepare GoTrackMoney

Before importing the data, ensure that the GoTrackMoney backend and frontend are currently running.
You can start them using docker compose or by running them manually:
```bash
docker-compose up -d
```

## Step 3: Run the Porting Script

A custom Python script is provided at `tests/import_csv.py` to automatically ingest these CSVs. 
The script is smart enough to detect whether a file contains expenses or incomes based on the column headers. It will automatically create missing categories, format dates to ISO standards, and insert the transactions under a default user account (`Anna`).

To import your data, run the script for each file from your terminal:

**1. Import Expenses**
```bash
python tests/import_csv.py /Users/gabri/Desktop/expenses_old_data.csv
```

**2. Import Incomes**
```bash
python tests/import_csv.py /Users/gabri/Desktop/incomes_old_data.csv
```

## Step 4: Login & Verify

Once the scripts complete, they will print out the login credentials used for the imported data.

- **Username**: `Anna`
- **Password**: `AnnaSecurePassword!2026`

Log in to the web interface using these credentials, and you should see your dashboard fully populated with your historical data!
