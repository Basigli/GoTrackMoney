-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD COLUMN session_duration_hours INT NOT NULL DEFAULT 24;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users DROP COLUMN session_duration_hours;
-- +goose StatementEnd
