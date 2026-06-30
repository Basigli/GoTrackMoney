# Periodic Expenses Implementation

I implemented the Periodic Expenses feature across both the backend and frontend. Here's a breakdown of the changes:

## 1. Database Schema
Created a new Goose migration `00003_add_periodic_expenses.sql` that introduces the `periodic_expenses` table. This table stores the configuration for a recurring expense:
- `id`, `name`, `description`, `amount`, `user_id`, `category_id` (similar to standard expenses)
- `period_interval`: An integer representing the multiplier for the period (e.g., `1`, `2`).
- `period_unit`: A string representing the unit of time (e.g., `days`, `weeks`, `months`, `years`).
- `start_date`: The original starting timestamp.
- `next_due_date`: The next time the periodic expense should generate an actual expense record.
- `last_generated_date`: The timestamp when the expense was last generated.

## 2. SQLC Queries & Backend Models
- Appended new queries to `queries.sql` to manage periodic expenses (`CreatePeriodicExpense`, `ListPeriodicExpensesByUserID`, `DeletePeriodicExpense`, `UpdatePeriodicExpenseNextDueDate`, and `FindDuePeriodicExpensesByUserID`).
- Ran `sqlc generate` to automatically generate the database access code in Go.

## 3. Backend Logic (Service & Handlers)
- **Service Layer**: Added a new method `checkAndGeneratePeriodicExpenses` to the `ledger.Service`. This method is invoked every time the `/expenses` endpoint is hit.
  - It lazily finds all periodic expenses where `next_due_date <= now()`.
  - For each due periodic expense, it automatically inserts a standard `Expense` into the database.
  - It then computes the *next* due date by adding the specified `period_interval` and `period_unit` to the current `next_due_date`, and updates the periodic expense record.
- **API Endpoints**: Registered the endpoints `GET /periodic-expenses`, `POST /periodic-expenses`, and `DELETE /periodic-expenses/{id}` in the router (`api.go`) and corresponding handler implementations in `handlers.go`.

## 4. Frontend Application
- **`useData.ts`**: Introduced the `PeriodicExpense` TypeScript interface and added state variables and fetching logic for `periodicExpenses`.
- **`page.tsx`**: Updated the "Add Expense" modal.
  - Added a "Periodic Expense?" checkbox visible only when creating a new expense.
  - If checked, two new inputs appear: a numeric input for the interval and a dropdown for the time unit (`Days`, `Weeks`, `Months`, `Years`).
  - Adjusted the `handleAddSubmit` logic to POST to `/periodic-expenses` with the configured period settings instead of the standard `/expenses` endpoint when the user opts to create a periodic expense.

Now, whenever you add a periodic expense from the UI, it registers the configuration in the backend. Then, simply fetching the expenses on the dashboard dynamically applies and generates any due transactions based on the recurring pattern!
