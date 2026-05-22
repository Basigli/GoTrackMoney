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
  id, name, creator_id
FROM
  categories
ORDER BY
  id;

-- name: FindCategoryByID :one
SELECT
  id, name, creator_id
FROM
  categories
WHERE
  id = $1;

-- name: CreateCategory :one
INSERT INTO categories (name, creator_id)
VALUES ($1, $2)
RETURNING id, name, creator_id;

-- name: ListCategoriesByCreatorID :many
SELECT
  id, name, creator_id
FROM
  categories
WHERE
  creator_id = $1
ORDER BY
  id;

-- name: FindCategoryByIDAndCreatorID :one
SELECT
  id, name, creator_id
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
  created_at DESC, id DESC;

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
  created_at DESC, id DESC;

-- name: CreateIncome :one
INSERT INTO incomes (
  name, description, amount, user_id, category_id, received_on
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, name, description, amount, user_id, created_at, category_id, received_on;
