-- +goose Up
ALTER TABLE periodic_expenses ADD COLUMN paused BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE periodic_expenses ADD COLUMN schedule_anchor TIMESTAMPTZ;
UPDATE periodic_expenses SET schedule_anchor = next_due_date;
-- Keep inserts from the previous backend compatible during a staged rollout or rollback.
-- The new backend passes schedule_anchor explicitly; old clients omit it.
-- +goose StatementBegin
CREATE FUNCTION default_periodic_anchor() RETURNS trigger AS $$
BEGIN
  IF NEW.schedule_anchor IS NULL THEN
    NEW.schedule_anchor := NEW.next_due_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
CREATE TRIGGER periodic_anchor_on_insert BEFORE INSERT ON periodic_expenses
FOR EACH ROW EXECUTE FUNCTION default_periodic_anchor();
ALTER TABLE periodic_expenses ALTER COLUMN schedule_anchor SET NOT NULL;
CREATE INDEX expenses_user_date_idx ON expenses(user_id, spent_on DESC, id DESC);
CREATE INDEX incomes_user_date_idx ON incomes(user_id, received_on DESC, id DESC);

-- +goose Down
DROP INDEX incomes_user_date_idx;
DROP INDEX expenses_user_date_idx;
DROP TRIGGER periodic_anchor_on_insert ON periodic_expenses;
DROP FUNCTION default_periodic_anchor();
ALTER TABLE periodic_expenses DROP COLUMN schedule_anchor;
ALTER TABLE periodic_expenses DROP COLUMN paused;
