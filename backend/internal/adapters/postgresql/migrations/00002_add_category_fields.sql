-- +goose Up
-- +goose StatementBegin
ALTER TABLE categories ADD COLUMN emoji TEXT NOT NULL DEFAULT '📝';
ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'expense';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE categories DROP COLUMN emoji;
ALTER TABLE categories DROP COLUMN type;
-- +goose StatementEnd
