# GoTrackMoney

GoTrackMoney is a modern, responsive, and robust personal finance tracking application. It is built with a fast **Go** backend and a sleek **Next.js** frontend, allowing users to track their incomes, expenses, manage custom categories, and visualize their financial data over time.

## Features

- **Dashboard**: Quick overview of recent transactions.
- **Analytics & Charts**: View your expenses by category and track incomes vs. expenses over the last 6 months using responsive charts.
- **Search & Filter**: Search transactions by date range and category. Edit or delete them directly from the search results.
- **Categories Management**: Create custom categories with emojis for both expenses and incomes.
- **Data Export**: Export all your financial data to a CSV file in one click.
- **User Authentication**: Secure login/registration system with customizable session durations.
- **Internationalization (i18n)**: Fully localized in both English and Italian.
- **Responsive Design**: Beautiful, glassmorphism-inspired UI that works flawlessly on desktop, tablets, and mobile devices.

## Tech Stack

- **Backend**: Go (Golang), Chi Router, PostgreSQL, `sqlc` (for type-safe SQL generation), `goose` (for database migrations), JWT authentication.
- **Frontend**: Next.js (React), TypeScript, Vanilla CSS (CSS Variables & Glassmorphism), `recharts` (for data visualization), `react-hot-toast` (notifications), `react-datepicker`.
- **Infrastructure**: Docker & Docker Compose for seamless production deployment.

## Getting Started

### Prerequisites

- Go (1.23+)
- Node.js (20.9.0+)
- PostgreSQL (15+)
- Docker & Docker Compose (for production setup)

---

### Running Locally (Development)

**1. Database Setup**
Make sure PostgreSQL is running. Create a database named `ecom` (or your preferred name) and update the DSN in your backend configuration.

**2. Backend**
```bash
cd backend
# Run migrations
goose -dir ./internal/adapters/postgresql/migrations postgres "host=localhost user=postgres password=postgres dbname=ecom sslmode=disable" up
# Start the Go server
go run cmd/api.go
```
The backend will run on `http://localhost:8080`.

**3. Frontend**
```bash
cd frontend
npm install
npm run dev
```
The frontend will run on `http://localhost:3000`.

---

### Running in Production (Docker Compose)

The entire application can be spun up using Docker Compose. This automatically handles the database setup, backend migrations, and building the standalone Next.js frontend.

```bash
# From the root directory of the project
docker-compose up --build -d
```

- Frontend: Accessible at `http://localhost:3000`
- Backend API: Accessible at `http://localhost:8080`
- PostgreSQL: Accessible at `localhost:5432`

## Testing with Mock Data

To see the app in action without manually entering data, you can use the provided Python script to generate 2 years' worth of realistic transactions (salaries, rent, groceries, etc.).

```bash
# Make sure the backend and database are running!
python3 tests/generate_data.py

# Optional: a different backend, shorter history, or reproducible amounts
python3 tests/generate_data.py --api-url http://localhost:8098 --days 90 --seed 42
```
The script defaults to `http://localhost:8098` (override with `--api-url` or `API_BASE_URL`). Each run creates a new account and uses UTC timestamps.

The script will output the randomly generated username and password in the terminal. Log in with those credentials to explore the populated analytics and charts!

## Usability workflows and regression tests

Search now queries the complete transaction history. Filters are kept in the URL;
date filters are inclusive calendar dates in UTC. Analytics categories and monthly
bars link to the corresponding filtered search.

On the dashboard, open an expense category and choose **Add expense** to start
with that category selected. Historical views default to the first day of the
viewed month (January 1 for past-year views). Month navigation is shared with
Analytics and remembered per user on that browser.

Recurring expenses support full editing, pause/resume, and skipping the next
occurrence. Paused dates are not generated on resume. Active overdue occurrences
are generated on access, atomically, before edits apply. Monthly/yearly schedules
retain their anchor day and clamp to the last day of shorter months. Upcoming
totals include all occurrences in the next 7/30 days, excluding paused schedules.

The migration `20260925120000_recurring_controls.sql` must run before starting
the updated backend. Existing schedules remain active and retain their current
next due dates. Docker's backend entrypoint runs migrations automatically; update
the backend before the frontend. Generated SQLC files are checked in.

Run backend unit tests from `backend` with `go test ./...`. Database integration
and browser tests require a **separate migrated database whose name ends in
`_test`**. They create test users and transactions; never point them at your app's
database.

```bash
export TEST_DATABASE_URL='postgres://postgres:postgrespassword@localhost:5432/gotrackmoney_usability_test?sslmode=disable'
# Create the test database first, then apply the migrations:
goose -dir backend/internal/adapters/postgresql/migrations postgres "$TEST_DATABASE_URL" up
go -C backend test ./... -count=1

cd frontend
npm install
npx playwright install chromium
npm run test:e2e
```

Browser tests start their own backend on port 8198 and frontend on port 3100 and
run on desktop and mobile Chromium. Both ports must be free. Tests cover complete
history search, URL navigation, category entry, failed-save recovery, form
validation, recurring controls, and stale search responses.

New API routes: `GET /transactions/search` accepts `q`, `type` (`expense` or
`income`), `category_id`, `from`, `to`, `min_amount`, `max_amount`, `limit`
(default 50, maximum 100), and `offset`. It returns `items`, `total`, `limit`,
and `offset`. Recurring actions use `POST /periodic-expenses/{id}/pause`,
`/resume`, and `/skip`; `GET /periodic-expenses/upcoming` supplies occurrence
previews and totals. Updates to recurring expenses preserve omitted fields.

## Upgrading an installation with real data

The schema change is additive. It marks existing recurring schedules active and
sets each scheduling anchor to its current next due date. An insert trigger keeps
the previous backend able to create recurring schedules during a staged rollout.
Existing users, categories, expenses, and incomes are not removed.

Before upgrading, use the **same Compose file, project name, PostgreSQL major
version, and named database volume** as the running installation. This repo has
both `docker-compose.yml` (PostgreSQL 15, `db`, `pgdata`) and
`docker-compose.yaml` (PostgreSQL 16, `postgres`, `postgres-data`). The
commands below apply **only to deployments using `docker-compose.yml`**.
Inspect your running database container's Compose labels and mount first:

```bash
docker inspect gotrackmoney_db --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }} {{ index .Config.Labels "com.docker.compose.project" }}'
docker inspect gotrackmoney_db --format '{{range .Mounts}}{{.Name}}:{{.Destination}}{{end}}'
```

If your production container is `ecom-postgres` or uses the other Compose
file, adapt the commands to that existing stack; do not switch its volume or
PostgreSQL major version as part of this application upgrade. A different
project name can attach another volume and make the app appear empty. Do not
use `docker compose down --volumes` or `docker volume rm`.

1. Arrange a short maintenance window. Take a PostgreSQL custom-format backup to
   a protected path **outside the repository** and confirm that `pg_restore` can
   read its table of contents:

   ```bash
   docker compose -f docker-compose.yml exec -T db pg_dump -U postgres -d ecom -Fc > /secure/backups/gotrackmoney-before-upgrade.dump
   docker compose -f docker-compose.yml exec -T db pg_restore -l < /secure/backups/gotrackmoney-before-upgrade.dump
   ```

   Restore that archive into a separate staging database and rehearse the upgrade
   there when possible. Record user and transaction counts before deployment.

2. Review overdue schedules before starting the new backend:
   ```bash
   docker compose -f docker-compose.yml exec -T db psql -U postgres -d ecom -c "SELECT id, name, next_due_date FROM periodic_expenses WHERE next_due_date <= now() ORDER BY next_due_date;"
   ```
   The updated backend catches up **all** overdue active occurrences on the
   first relevant read. If some are unwanted, decide which schedules to pause
   before letting the new backend serve users.

3. Rebuild and start the backend first, then the frontend, without recreating
   the database volume:
   ```bash
   docker compose -f docker-compose.yml up -d --build backend
   docker compose -f docker-compose.yml logs --tail=100 backend
   docker compose -f docker-compose.yml up -d --build frontend
   ```
   The backend entrypoint runs pending Goose migrations before serving requests.
   Check its logs for a successful migration and confirm the prior user and
   transaction counts. Then check the app's search, analytics, and recurring
   pages against known records.

If the application must be rolled back, restore the previous backend/frontend
images **while keeping the migrated database**. The insert trigger keeps old
recurring-payment creates working. However, the old backend does **not** know
about paused schedules and may generate them on read; review or avoid recurrence
traffic until the updated backend is restored. Do not run `goose down` in
production: it would remove the new scheduling fields and pause settings.
Restoring the pre-upgrade database backup after new writes would discard those
writes, so use it only as a last-resort recovery with the data-loss window
understood.
