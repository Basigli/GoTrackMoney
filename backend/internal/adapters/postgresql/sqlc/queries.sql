-- name: ListUsers :many
SELECT
  id, username, password, session_duration_hours, is_admin
FROM
  users
ORDER BY
  id;

-- name: FindUserByUsername :one
SELECT
  id, username, password, session_duration_hours, is_admin
FROM
  users
WHERE
  username = $1;

-- name: FindUserByID :one
SELECT
  id, username, password, session_duration_hours, is_admin
FROM
  users
WHERE
  id = $1;

-- name: CreateUser :one
INSERT INTO users (username, password)
VALUES ($1, $2)
RETURNING id, username, password, session_duration_hours, is_admin;

-- name: UpdateUser :one
UPDATE users
SET username = COALESCE(NULLIF($2, ''), username),
    password = COALESCE(NULLIF($3, ''), password),
    session_duration_hours = COALESCE(NULLIF($4::int, 0), session_duration_hours)
WHERE id = $1
RETURNING id, username, password, session_duration_hours, is_admin;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;

-- name: ListCategories :many
SELECT
  id, name, creator_id, emoji, type, color
FROM
  categories
ORDER BY
  id;

-- name: FindCategoryByID :one
SELECT
  id, name, creator_id, emoji, type, color
FROM
  categories
WHERE
  id = $1;

-- name: CreateCategory :one
INSERT INTO categories (name, creator_id, emoji, type, color)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, creator_id, emoji, type, color;

-- name: ListCategoriesByCreatorID :many
SELECT
  id, name, creator_id, emoji, type, color
FROM
  categories
WHERE
  creator_id = $1
ORDER BY
  id;

-- name: FindCategoryByIDAndCreatorID :one
SELECT
  id, name, creator_id, emoji, type, color
FROM
  categories
WHERE
  id = $1 AND creator_id = $2;

-- name: ListExpenses :many
SELECT
  id, name, description, amount, user_id, created_at, category_id, spent_on, is_periodic
FROM
  expenses
ORDER BY
  created_at DESC, id DESC;

-- name: ListExpensesByUserID :many
SELECT
  id, name, description, amount, user_id, created_at, category_id, spent_on, is_periodic
FROM
  expenses
WHERE
  user_id = $1
ORDER BY
  created_at DESC, id DESC
LIMIT $2 OFFSET $3;

-- name: CreateExpense :one
INSERT INTO expenses (
  name, description, amount, user_id, category_id, spent_on, is_periodic
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, name, description, amount, user_id, created_at, category_id, spent_on, is_periodic;

-- name: ListIncomes :many
SELECT
  id, name, description, amount, user_id, created_at, category_id, received_on
FROM
  incomes
ORDER BY
  created_at DESC, id DESC;

-- name: ListIncomesByUserID :many
SELECT
  id, name, description, amount, user_id, created_at, category_id, received_on
FROM
  incomes
WHERE
  user_id = $1
ORDER BY
  created_at DESC, id DESC
LIMIT $2 OFFSET $3;

-- name: CreateIncome :one
INSERT INTO incomes (
  name, description, amount, user_id, category_id, received_on
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, name, description, amount, user_id, created_at, category_id, received_on;

-- name: DeleteExpense :exec
DELETE FROM expenses
WHERE id = $1 AND user_id = $2;

-- name: DeleteIncome :exec
DELETE FROM incomes
WHERE id = $1 AND user_id = $2;

-- name: UpdateCategory :one
UPDATE categories
SET
  name = $2,
  emoji = $3,
  type = $4,
  color = $6
WHERE
  id = $1 AND creator_id = $5
RETURNING id, name, creator_id, emoji, type, color;

-- name: UpdateExpense :one
UPDATE expenses
SET
  name = $2,
  description = $3,
  amount = $4,
  category_id = $5,
  spent_on = $6
WHERE
  id = $1 AND user_id = $7
RETURNING id, name, description, amount, user_id, created_at, category_id, spent_on, is_periodic;

-- name: UpdateIncome :one
UPDATE incomes
SET
  name = $2,
  description = $3,
  amount = $4,
  category_id = $5,
  received_on = $6
WHERE
  id = $1 AND user_id = $7
RETURNING id, name, description, amount, user_id, created_at, category_id, received_on;

-- name: ListPeriodicExpensesByUserID :many
SELECT
  id, name, description, amount, user_id, category_id, period_interval, period_unit, start_date, last_generated_date, next_due_date, created_at, paused, schedule_anchor
FROM
  periodic_expenses
WHERE
  user_id = $1
ORDER BY
  created_at DESC, id DESC;

-- name: CreatePeriodicExpense :one
INSERT INTO periodic_expenses (
  name, description, amount, user_id, category_id, period_interval, period_unit, start_date, next_due_date, schedule_anchor
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
RETURNING id, name, description, amount, user_id, category_id, period_interval, period_unit, start_date, last_generated_date, next_due_date, created_at, paused, schedule_anchor;

-- name: UpdatePeriodicExpense :one
UPDATE periodic_expenses
SET
  period_interval = $2,
  period_unit = $3,
  next_due_date = $4,
  name = $6, description = $7, amount = $8, category_id = $9, paused = $10, schedule_anchor = $11
WHERE
  id = $1 AND user_id = $5
RETURNING id, name, description, amount, user_id, category_id, period_interval, period_unit, start_date, last_generated_date, next_due_date, created_at, paused, schedule_anchor;

-- name: FindDuePeriodicExpensesByUserID :many
SELECT
  id, name, description, amount, user_id, category_id, period_interval, period_unit, start_date, last_generated_date, next_due_date, created_at, paused, schedule_anchor
FROM
  periodic_expenses
WHERE
  user_id = $1 AND NOT paused AND next_due_date <= now()
ORDER BY id FOR UPDATE;

-- name: UpdatePeriodicExpenseNextDueDate :exec
UPDATE periodic_expenses
SET
  last_generated_date = $2,
  next_due_date = $3
WHERE
  id = $1;

-- name: DeletePeriodicExpense :exec
DELETE FROM periodic_expenses
WHERE id = $1 AND user_id = $2;

-- name: CountUsers :one
SELECT COUNT(*) FROM users;

-- name: UpdateUserRole :exec
UPDATE users SET is_admin = $2 WHERE id = $1;

-- name: FilterExpensesByDate :many
SELECT
  id, name, description, amount, user_id, created_at, category_id, spent_on, is_periodic
FROM
  expenses
WHERE
  user_id = $1 AND spent_on >= $2 AND spent_on < $3
ORDER BY
  spent_on DESC, id DESC;

-- name: FilterIncomesByDate :many
SELECT
  id, name, description, amount, user_id, created_at, category_id, received_on
FROM
  incomes
WHERE
  user_id = $1 AND received_on >= $2 AND received_on < $3
ORDER BY
  received_on DESC, id DESC;

-- name: GetExpensesByCategory :many
SELECT
  category_id, SUM(amount)::float AS total_amount
FROM
  expenses
WHERE
  user_id = $1 AND spent_on >= $2 AND spent_on < $3
GROUP BY
  category_id;

-- name: GetMonthlyExpenseTotals :many
SELECT
  EXTRACT(YEAR FROM spent_on)::int AS year,
  EXTRACT(MONTH FROM spent_on)::int AS month,
  SUM(amount)::float AS total_amount
FROM
  expenses
WHERE
  user_id = $1 AND spent_on >= $2 AND spent_on < $3
GROUP BY
  EXTRACT(YEAR FROM spent_on), EXTRACT(MONTH FROM spent_on)
ORDER BY
  year, month;

-- name: GetMonthlyIncomeTotals :many
SELECT
  EXTRACT(YEAR FROM received_on)::int AS year,
  EXTRACT(MONTH FROM received_on)::int AS month,
  SUM(amount)::float AS total_amount
FROM
  incomes
WHERE
  user_id = $1 AND received_on >= $2 AND received_on < $3
GROUP BY
  EXTRACT(YEAR FROM received_on), EXTRACT(MONTH FROM received_on)
ORDER BY
  year, month;

-- name: LockPeriodicExpense :one
SELECT * FROM periodic_expenses WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: SearchTransactions :one
WITH transactions AS (
 SELECT e.id, 'expense'::text AS type, e.name, e.description, e.amount,
        e.category_id, COALESCE(e.spent_on, e.created_at) AS date, e.is_periodic
 FROM expenses e WHERE e.user_id = sqlc.arg(user_id)
 UNION ALL
 SELECT i.id, 'income'::text AS type, i.name, i.description, i.amount,
        i.category_id, COALESCE(i.received_on, i.created_at) AS date, false AS is_periodic
 FROM incomes i WHERE i.user_id = sqlc.arg(user_id)
), filtered AS (
 SELECT t.* FROM transactions t JOIN categories c ON c.id = t.category_id
 WHERE (sqlc.arg(kind)::text = '' OR t.type = sqlc.arg(kind))
 AND (sqlc.arg(category)::bigint = 0 OR t.category_id = sqlc.arg(category))
 AND (sqlc.narg(date_from)::timestamptz IS NULL OR t.date >= sqlc.narg(date_from))
 AND (sqlc.narg(date_to)::timestamptz IS NULL OR t.date < sqlc.narg(date_to))
 AND t.amount >= sqlc.arg(min_amount)::float8 AND t.amount <= sqlc.arg(max_amount)::float8
 AND (sqlc.arg(query)::text = '' OR
      strpos(lower(t.name || ' ' || t.description || ' ' || c.name), lower(sqlc.arg(query))) > 0
      OR t.amount = sqlc.arg(exact_amount)::float8)
), page AS (
 SELECT * FROM filtered ORDER BY date DESC, type, id DESC
 LIMIT sqlc.arg(page_limit)::int OFFSET sqlc.arg(page_offset)::int
)
SELECT jsonb_build_object(
 'items', COALESCE((SELECT jsonb_agg(page ORDER BY date DESC, type, id DESC) FROM page), '[]'::jsonb),
 'total', (SELECT count(*) FROM filtered),
 'limit', sqlc.arg(page_limit)::int, 'offset', sqlc.arg(page_offset)::int
)::jsonb AS result;
