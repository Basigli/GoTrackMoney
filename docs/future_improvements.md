# Future Improvements & Roadmap

GoTrackMoney is continuously evolving. Below is a list of considered future improvements and roadmap ideas to take the application to the next level. If you are interested in contributing or expanding the app, these are excellent starting points.

## 1. Monthly Budgets & Category Limits 🎯
Currently, the app tracks spending but does not enforce or visualize spending limits.
- **Concept:** Allow users to set a monthly budget for specific categories (e.g., "Maximum 200€ for Dining Out").
- **Implementation Idea:** Add visual warning bars on the dashboard or analytics page that change color (e.g., green to orange to red) as the user approaches their monthly limit.

## 2. Multiple Wallets / Accounts 🏦
Right now, all money is pooled into one global balance.
- **Concept:** Introduce "Wallets" to track where the money physically or digitally resides (e.g., "Cash", "Main Bank Account", "Credit Card", "Savings Account").
- **Implementation Idea:** When adding an expense or income, the user selects which wallet the transaction belongs to. This allows tracking exact credit card debt versus liquid cash.

## 3. Savings Goals 🏖️
Instead of just tracking past expenses, track future aspirations.
- **Concept:** Users can create a goal like "New Car" or "Trip to Japan" with a target amount.
- **Implementation Idea:** Allow users to "transfer" money from their main balance into the goal and display a progress bar that fills up over time on the dashboard.

## 4. Periodic Incomes 🔁
We have a robust system for **Periodic Expenses** (like subscriptions or bills).
- **Concept:** Expand the periodic logic to support **Periodic Incomes**.
- **Implementation Idea:** Allow users to configure their monthly salary or rental income to be generated completely automatically on a specific day of the month.

## 5. Receipt & File Attachments 📎
For expensive purchases or tax purposes, keeping physical or digital receipts is crucial.
- **Concept:** Allow attaching images or PDFs to specific transactions.
- **Implementation Idea:** Add an image upload button to the "Add/Edit Transaction" modal. Files would be stored securely on the backend (e.g., in a Docker volume) and linked to the transaction record in the database.

## 6. CSV Bank Importer (Web UI) 📥
Currently, importing massive amounts of data requires using the backend Python script.
- **Concept:** Build a sleek, drag-and-drop web UI for importing data directly from real banks.
- **Implementation Idea:** The user exports a CSV from their bank, drops it into the GoTrackMoney UI, and the app attempts to auto-categorize the transactions, allowing the user to review and bulk-import them in seconds.
