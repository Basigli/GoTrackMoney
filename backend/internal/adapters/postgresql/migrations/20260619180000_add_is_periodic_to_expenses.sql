-- +goose Up
-- +goose StatementBegin
ALTER TABLE expenses ADD COLUMN is_periodic BOOLEAN NOT NULL DEFAULT FALSE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE expenses DROP COLUMN is_periodic;
-- +goose StatementEnd
