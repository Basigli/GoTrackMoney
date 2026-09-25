package ledger

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
)

func validateRecurrence(interval int32, unit string) error {
	if interval < 1 || interval > 10000 {
		return fmt.Errorf("period_interval must be between 1 and 10000")
	}
	switch unit {
	case "days", "weeks", "months", "years":
		return nil
	}
	return fmt.Errorf("invalid period_unit")
}

// Advance from the last due date while retaining the original day of month.
func nextOccurrence(due, anchor time.Time, interval int32, unit string) (time.Time, error) {
	if err := validateRecurrence(interval, unit); err != nil {
		return time.Time{}, err
	}
	due, anchor = due.UTC(), anchor.UTC()
	switch unit {
	case "days":
		return due.AddDate(0, 0, int(interval)), nil
	case "weeks":
		return due.AddDate(0, 0, int(interval)*7), nil
	}
	year, month := due.Year(), due.Month()
	if unit == "months" {
		first := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC).AddDate(0, int(interval), 0)
		year, month = first.Year(), first.Month()
	} else {
		year += int(interval)
		month = anchor.Month()
	}
	day := min(anchor.Day(), time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day())
	return time.Date(year, month, day, due.Hour(), due.Minute(), due.Second(), due.Nanosecond(), time.UTC), nil
}

func (s *svc) transaction(ctx context.Context, fn func(repo.Querier) error) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := fn(repo.New(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Caller holds a row lock until both the inserts and advancement commit.
func generateDue(ctx context.Context, q repo.Querier, pe *repo.PeriodicExpense, now time.Time) error {
	if pe.Paused {
		return nil
	}
	for !pe.NextDueDate.Time.After(now) {
		if err := ctx.Err(); err != nil {
			return err
		}
		next, err := nextOccurrence(pe.NextDueDate.Time, pe.ScheduleAnchor.Time, pe.PeriodInterval, pe.PeriodUnit)
		if err != nil {
			return err
		}
		_, err = q.CreateExpense(ctx, repo.CreateExpenseParams{
			Name: pe.Name, Description: pe.Description, Amount: pe.Amount, UserID: pe.UserID,
			CategoryID: pe.CategoryID, SpentOn: pe.NextDueDate, IsPeriodic: true,
		})
		if err != nil {
			return err
		}
		pe.LastGeneratedDate = pe.NextDueDate
		pe.NextDueDate = pgtype.Timestamptz{Time: next, Valid: true}
		if err := q.UpdatePeriodicExpenseNextDueDate(ctx, repo.UpdatePeriodicExpenseNextDueDateParams{
			ID: pe.ID, LastGeneratedDate: pe.LastGeneratedDate, NextDueDate: pe.NextDueDate,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *svc) checkAndGeneratePeriodicExpenses(ctx context.Context, userID int64) error {
	return s.transaction(ctx, func(q repo.Querier) error {
		rows, err := q.FindDuePeriodicExpensesByUserID(ctx, userID)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		for _, pe := range rows {
			if err := generateDue(ctx, q, &pe, now); err != nil {
				return err
			}
		}
		return nil
	})
}

func saveSchedule(ctx context.Context, q repo.Querier, pe repo.PeriodicExpense) (repo.PeriodicExpense, error) {
	return q.UpdatePeriodicExpense(ctx, repo.UpdatePeriodicExpenseParams{
		ID: pe.ID, UserID: pe.UserID, Name: pe.Name, Description: pe.Description, Amount: pe.Amount,
		CategoryID: pe.CategoryID, PeriodInterval: pe.PeriodInterval, PeriodUnit: pe.PeriodUnit,
		NextDueDate: pe.NextDueDate, Paused: pe.Paused, ScheduleAnchor: pe.ScheduleAnchor,
	})
}

func (s *svc) changeSchedule(ctx context.Context, id int64, change func(repo.Querier, *repo.PeriodicExpense, time.Time) error) (result repo.PeriodicExpense, err error) {
	user, err := currentUser(ctx)
	if err != nil {
		return result, err
	}
	err = s.transaction(ctx, func(q repo.Querier) error {
		pe, err := q.LockPeriodicExpense(ctx, repo.LockPeriodicExpenseParams{ID: id, UserID: user.ID})
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		if err := generateDue(ctx, q, &pe, now); err != nil {
			return err
		}
		if err := change(q, &pe, now); err != nil {
			return err
		}
		result, err = saveSchedule(ctx, q, pe)
		return err
	})
	return
}

func (s *svc) UpdatePeriodicExpense(ctx context.Context, p updatePeriodicExpenseParams) (repo.PeriodicExpense, error) {
	return s.changeSchedule(ctx, p.ID, func(q repo.Querier, pe *repo.PeriodicExpense, now time.Time) error {
		if p.Name != nil {
			pe.Name = *p.Name
		}
		if p.Description != nil {
			pe.Description = *p.Description
		}
		if p.Amount != nil {
			pe.Amount = *p.Amount
		}
		if p.CategoryID != nil {
			pe.CategoryID = *p.CategoryID
		}
		scheduleChanged := (p.PeriodInterval != nil && *p.PeriodInterval != pe.PeriodInterval) || (p.PeriodUnit != nil && *p.PeriodUnit != pe.PeriodUnit)
		if scheduleChanged {
			pe.ScheduleAnchor = pe.NextDueDate
		}
		if p.PeriodInterval != nil {
			pe.PeriodInterval = *p.PeriodInterval
		}
		if p.PeriodUnit != nil {
			pe.PeriodUnit = *p.PeriodUnit
		}
		if pe.Name == "" {
			return fmt.Errorf("name is required")
		}
		if pe.Amount <= 0 || math.IsNaN(pe.Amount) || math.IsInf(pe.Amount, 0) {
			return fmt.Errorf("amount must be greater than zero")
		}
		if err := validateRecurrence(pe.PeriodInterval, pe.PeriodUnit); err != nil {
			return err
		}
		category, err := q.FindCategoryByIDAndCreatorID(ctx, repo.FindCategoryByIDAndCreatorIDParams{ID: pe.CategoryID, CreatorID: pe.UserID})
		if err != nil {
			return ErrCategoryNotFound
		}
		if category.Type != "expense" {
			return fmt.Errorf("category type must be expense")
		}
		if p.NextDueDate != nil {
			if !p.NextDueDate.After(now) {
				return fmt.Errorf("next_due_date must be in the future")
			}
			pe.NextDueDate = timestamptzFromTime(p.NextDueDate)
			pe.ScheduleAnchor = pe.NextDueDate
		}
		return nil
	})
}

func (s *svc) PeriodicAction(ctx context.Context, id int64, action string) (repo.PeriodicExpense, error) {
	return s.changeSchedule(ctx, id, func(_ repo.Querier, pe *repo.PeriodicExpense, now time.Time) error {
		switch action {
		case "pause":
			pe.Paused = true
		case "resume":
			if !pe.Paused {
				return nil
			}
			for !pe.NextDueDate.Time.After(now) {
				if err := ctx.Err(); err != nil {
					return err
				}
				next, err := nextOccurrence(pe.NextDueDate.Time, pe.ScheduleAnchor.Time, pe.PeriodInterval, pe.PeriodUnit)
				if err != nil {
					return err
				}
				pe.NextDueDate = pgtype.Timestamptz{Time: next, Valid: true}
			}
			pe.Paused = false
		case "skip":
			if pe.Paused {
				return fmt.Errorf("resume the schedule before skipping")
			}
			next, err := nextOccurrence(pe.NextDueDate.Time, pe.ScheduleAnchor.Time, pe.PeriodInterval, pe.PeriodUnit)
			if err != nil {
				return err
			}
			pe.NextDueDate = pgtype.Timestamptz{Time: next, Valid: true}
		default:
			return fmt.Errorf("invalid action")
		}
		return nil
	})
}

type upcomingPayment struct {
	ScheduleID int64     `json:"schedule_id"`
	Name       string    `json:"name"`
	Amount     float64   `json:"amount"`
	DueDate    time.Time `json:"due_date"`
}
type upcomingPayments struct {
	AsOf    time.Time         `json:"as_of"`
	Total7  float64           `json:"total_7"`
	Total30 float64           `json:"total_30"`
	Items   []upcomingPayment `json:"items"`
}

func (s *svc) UpcomingPayments(ctx context.Context) (upcomingPayments, error) {
	result := upcomingPayments{AsOf: time.Now().UTC(), Items: []upcomingPayment{}}
	rows, err := s.ListPeriodicExpenses(ctx)
	if err != nil {
		return result, err
	}
	end7, end30 := result.AsOf.AddDate(0, 0, 7), result.AsOf.AddDate(0, 0, 30)
	for _, pe := range rows {
		if pe.Paused {
			continue
		}
		for due := pe.NextDueDate.Time; due.Before(end30); {
			result.Items = append(result.Items, upcomingPayment{pe.ID, pe.Name, pe.Amount, due})
			result.Total30 += pe.Amount
			if due.Before(end7) {
				result.Total7 += pe.Amount
			}
			due, err = nextOccurrence(due, pe.ScheduleAnchor.Time, pe.PeriodInterval, pe.PeriodUnit)
			if err != nil {
				return result, err
			}
		}
	}
	sort.Slice(result.Items, func(i, j int) bool { return result.Items[i].DueDate.Before(result.Items[j].DueDate) })
	return result, nil
}
