package ledger

import (
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
)

func TestIntegrationExpenseDuplicateDetection(t *testing.T) {
	s, ctx, cat := integrationService(t)
	date := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	start, end, _, _ := expenseDayBounds(&date, "Europe/Rome")
	otherCategory, err := s.CreateCategory(ctx, createCategoryParams{Name: "Dining", Emoji: "x", Type: "expense"})
	if err != nil {
		t.Fatal(err)
	}
	insert := func(description string, amount float64, category int64, spentOn time.Time, periodic bool) repo.Expense {
		t.Helper()
		row, err := s.repo.CreateExpense(ctx, repo.CreateExpenseParams{Name: "Purchase", Description: description,
			Amount: amount, CategoryID: category, UserID: otherCategory.CreatorID,
			SpentOn: timestamptzFromTime(&spentOn), IsPeriodic: periodic})
		if err != nil {
			t.Fatal(err)
		}
		return row
	}
	first := insert("  DINNER   out ", 12.504, cat, end.Add(-time.Minute), false)
	insert("Other wording", 12.5, otherCategory.ID, start.Add(time.Minute), false)
	for i := 0; i < 5; i++ {
		insert("Coffee", 12.5, cat, date.Add(time.Duration(i)*time.Minute), false)
	}
	insert("Outside day", 12.5, cat, start.Add(-time.Microsecond), false)
	insert("Outside day", 12.5, cat, end, false)
	insert("Different amount", 12.51, cat, date, false)
	otherService, otherCtx, otherCat := integrationService(t)
	if _, err := otherService.CreateExpense(otherCtx, createExpenseParams{Name: "Private purchase", Amount: 12.5, CategoryID: otherCat, SpentOn: &date}); err != nil {
		t.Fatal(err)
	}

	p := createExpenseParams{Name: "Food", Description: "Dinner out", Amount: 12.5, CategoryID: cat,
		SpentOn: &date, Timezone: "Europe/Rome"}
	_, err = s.CreateExpense(ctx, p)
	var review *duplicateExpenseError
	if !errors.As(err, &review) || review.Total != 7 || len(review.Matches) != 5 || review.Matches[0].ID != first.ID {
		t.Fatalf("incorrect matching, ranking, count or user isolation: %+v %v", review, err)
	}
	pool := s.db.(*pgxpool.Pool)
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM expenses WHERE user_id=$1", otherCategory.CreatorID).Scan(&count); err != nil || count != 10 {
		t.Fatalf("review inserted an expense: %d %v", count, err)
	}
	p.AllowDuplicate = true
	if _, err = s.CreateExpense(ctx, p); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM expenses WHERE user_id=$1", otherCategory.CreatorID).Scan(&count); err != nil || count != 11 {
		t.Fatalf("confirmation did not insert exactly once: %d %v", count, err)
	}

	periodic := insert("Automatic bill", 4.99, cat, date, true)
	p.Amount, p.AllowDuplicate = 4.99, false
	_, err = s.CreateExpense(ctx, p)
	if !errors.As(err, &review) || len(review.Matches) != 1 || review.Matches[0].ID != periodic.ID || !review.Matches[0].IsPeriodic {
		t.Fatalf("missing recurring expense: %+v %v", review, err)
	}
	legacy, err := s.repo.CreateExpense(ctx, repo.CreateExpenseParams{Name: "Legacy purchase", Amount: 5.99,
		UserID: otherCategory.CreatorID, CategoryID: cat, SpentOn: pgtype.Timestamptz{}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, "UPDATE expenses SET created_at=$1 WHERE id=$2", date, legacy.ID); err != nil {
		t.Fatal(err)
	}
	p.Amount = 5.99
	_, err = s.CreateExpense(ctx, p)
	if !errors.As(err, &review) || len(review.Matches) != 1 || review.Matches[0].ID != legacy.ID || !review.Matches[0].SpentOn.Equal(date) {
		t.Fatalf("missing legacy fallback date: %+v %v", review, err)
	}
	p.Amount = 6.99
	if _, err := s.CreateExpense(ctx, p); err != nil {
		t.Fatalf("different amount should save: %v", err)
	}
	p.Amount = 12.5
	nextDay := end.AddDate(0, 0, 1).Add(time.Hour)
	p.SpentOn = &nextDay
	if _, err := s.CreateExpense(ctx, p); err != nil {
		t.Fatalf("different day should save: %v", err)
	}
}
