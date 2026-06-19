-- +goose Up
-- +goose StatementBegin
ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE categories DROP COLUMN color;
-- +goose StatementEnd
