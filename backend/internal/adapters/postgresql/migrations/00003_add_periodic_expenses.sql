-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS periodic_expenses (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount DOUBLE PRECISION NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id),
  category_id BIGINT NOT NULL REFERENCES categories(id),
  period_interval INT NOT NULL DEFAULT 1,
  period_unit TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  last_generated_date TIMESTAMPTZ,
  next_due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS periodic_expenses;
-- +goose StatementEnd
