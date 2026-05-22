# Finance API

## Running the DB

```bash
docker compose up -d
```

## Running the API

```bash
go run cmd/*.go
```

## Auth

1. Register with `POST /users`.
2. Or log in with `POST /auth/login`.
3. Use `Authorization: Bearer <token>` on protected routes.

## Available endpoints

- `GET /health`
- `POST /users`
- `POST /auth/login`
- `GET /auth/me`
- `GET /users`
- `GET /categories`, `POST /categories`
- `GET /expenses`, `POST /expenses`
- `GET /incomes`, `POST /incomes`

## Database

The schema is defined with Goose migrations in `internal/adapters/postgresql/migrations/` and matches:

- `users`
- `categories`
- `expenses`
- `incomes`
