-- name: ListUsers :many
SELECT
  id, username, password
FROM
  users
ORDER BY
  id;

-- name: FindUserByUsername :one
SELECT
  id, username, password
FROM
  users
WHERE
  username = $1;

-- name: FindUserByID :one
SELECT
  id, username, password
FROM
  users
WHERE
  id = $1;

-- name: CreateUser :one
INSERT INTO users (username, password)
VALUES ($1, $2)
RETURNING id, username, password;

-- name: ListCategories :many
SELECT
  id, name, creator_id, emoji, type
FROM
  categories
ORDER BY
  id;

-- name: FindCategoryByID :one
SELECT
  id, name, creator_id, emoji, type
FROM
  categories
WHERE
  id = $1;

-- name: CreateCategory :one
INSERT INTO categories (name, creator_id, emoji, type)
VALUES ($1, $2, $3, $4)
RETURNING id, name, creator_id, emoji, type;

-- name: ListCategoriesByCreatorID :many
SELECT
  id, name, creator_id, emoji, type
FROM
  categories
WHERE
  creator_id = $1
ORDER BY
  id;

-- name: FindCategoryByIDAndCreatorID :one
SELECT
  id, name, creator_id, emoji, type
FROM
  categories
WHERE
  id = $1 AND creator_id = $2;

-- name: ListExpenses :many
SELECT
  id, name, description, amount, user_id, created_at, category_id, spent_on
FROM
  expenses
ORDER BY
  created_at DESC, id DESC;

-- name: ListExpensesByUserID :many
SELECT
  id, name, description, amount, user_id, created_at, category_id, spent_on
FROM
  expenses
WHERE
  user_id = $1
ORDER BY
  created_at DESC, id DESC
LIMIT $2 OFFSET $3;

-- name: CreateExpense :one
INSERT INTO expenses (
  name, description, amount, user_id, category_id, spent_on
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, name, description, amount, user_id, created_at, category_id, spent_on;

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

-- name: UpdateCategory :one
UPDATE categories
SET
  name = $2,
  emoji = $3,
  type = $4
WHERE
  id = $1 AND creator_id = $5
RETURNING id, name, creator_id, emoji, type;

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
RETURNING id, name, description, amount, user_id, created_at, category_id, spent_on;

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
  id, name, description, amount, user_id, category_id, period_interval, period_unit, start_date, last_generated_date, next_due_date, created_at
FROM
  periodic_expenses
WHERE
  user_id = $1
ORDER BY
  created_at DESC, id DESC;

-- name: CreatePeriodicExpense :one
INSERT INTO periodic_expenses (
  name, description, amount, user_id, category_id, period_interval, period_unit, start_date, next_due_date
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, name, description, amount, user_id, category_id, period_interval, period_unit, start_date, last_generated_date, next_due_date, created_at;

-- name: FindDuePeriodicExpensesByUserID :many
SELECT
  id, name, description, amount, user_id, category_id, period_interval, period_unit, start_date, last_generated_date, next_due_date, created_at
FROM
  periodic_expenses
WHERE
  user_id = $1 AND next_due_date <= now();

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
