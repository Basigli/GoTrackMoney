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
```
The script will output the randomly generated username and password in the terminal. Log in with those credentials to explore the populated analytics and charts!
