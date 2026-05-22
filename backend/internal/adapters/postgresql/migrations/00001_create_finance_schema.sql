-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id BIGINT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount DOUBLE PRECISION NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_id BIGINT NOT NULL REFERENCES categories(id),
  spent_on TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS incomes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount DOUBLE PRECISION NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_id BIGINT NOT NULL REFERENCES categories(id),
  received_on TIMESTAMPTZ
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS incomes;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
-- +goose StatementEnd
