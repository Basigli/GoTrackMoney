# Getting Started

This guide explains how to get GoTrackMoney running on your local machine for development or on a server for production.

## Tech Stack

- **Backend**: Go (Golang), Chi Router, PostgreSQL, `sqlc` (for type-safe SQL generation), `goose` (for database migrations), JWT authentication.
- **Frontend**: Next.js (React), TypeScript, Vanilla CSS (CSS Variables & Glassmorphism), `recharts` (for data visualization), `react-hot-toast` (notifications), `react-datepicker`.
- **Infrastructure**: Docker & Docker Compose for seamless production deployment.

## Prerequisites

- Go (1.23+)
- Node.js (20.9.0+)
- PostgreSQL (15+)
- Docker & Docker Compose (for production setup)

---

## Running in Production (Docker Compose)

The entire application can be spun up using Docker Compose. This automatically handles the database setup, backend migrations, and building the standalone Next.js frontend.

```bash
# From the root directory of the project
docker compose up -d --build
```

### Port Mappings

- **Frontend**: Accessible at `http://localhost:3000` (Map port 3000 in your reverse proxy)
- **Backend API**: Accessible at `http://localhost:8098`
- **PostgreSQL**: Accessible at `localhost:5432`

*Note: Ensure your Pi-Hole or local DNS is not intercepting Docker's internal networking on port 53. If you run into DNS resolution issues, check out the explicit bridge network config in `docker-compose.yml`.*

---

## Running Locally (Development)

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
The backend will run on `http://localhost:8098`.

**3. Frontend**
```bash
cd frontend
npm install
npm run dev
```
The frontend will run on `http://localhost:3000`.

---

## Testing with Mock Data

To see the app in action without manually entering data, you can use the provided Python script to generate 2 years' worth of realistic transactions (salaries, rent, groceries, etc.).

```bash
# Make sure the backend and database are running!
python3 tests/generate_data.py
```
The script will output the randomly generated username and password in the terminal. Log in with those credentials to explore the populated analytics and charts!
