package ledger

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/auth"
)

func integrationService(t *testing.T) (*svc, context.Context, int64) {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to a migrated database ending in _test")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(pool.Config().ConnConfig.Database, "_test") {
		pool.Close()
		t.Fatal("integration tests require a database ending in _test")
	}
	q := repo.New(pool)
	user, err := q.CreateUser(context.Background(), repo.CreateUserParams{Username: fmt.Sprintf("integration_%d", time.Now().UnixNano()), Password: "test-only"})
	if err != nil {
		pool.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		for _, table := range []string{"expenses", "incomes", "periodic_expenses", "categories", "users"} {
			column := "user_id"
			if table == "categories" {
				column = "creator_id"
			}
			if table == "users" {
				column = "id"
			}
			if _, err := pool.Exec(context.Background(), "DELETE FROM "+table+" WHERE "+column+"=$1", user.ID); err != nil {
				t.Error(err)
			}
		}
		pool.Close()
	})
	s := NewService(q, pool).(*svc)
	ctx := auth.WithUser(context.Background(), auth.User{ID: user.ID, Username: user.Username})
	cat, err := s.CreateCategory(ctx, createCategoryParams{Name: "Groceries", Emoji: "x", Type: "expense"})
	if err != nil {
		t.Fatal(err)
	}
	return s, ctx, cat.ID
}

func TestIntegrationCompleteHistorySearch(t *testing.T) {
	s, ctx, cat := integrationService(t)
	start := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 125; i++ {
		date := start.AddDate(0, 0, i)
		name := "recent"
		if i == 0 {
			name = "old needle"
		}
		if _, err := s.CreateExpense(ctx, createExpenseParams{Name: name, Amount: 12.5, CategoryID: cat, SpentOn: &date}); err != nil {
			t.Fatal(err)
		}
	}
	p, _ := parseSearch(httptest.NewRequest("GET", "/?q=needle", nil))
	result, err := s.SearchTransactions(ctx, p)
	if err != nil {
		t.Fatal(err)
	}
	var data struct {
		Total int
		Items []struct {
			ID   int64
			Name string
		}
	}
	if err = json.Unmarshal(result, &data); err != nil {
		t.Fatal(err)
	}
	if data.Total != 1 || data.Items[0].Name != "old needle" {
		t.Fatalf("missing historic result: %s", result)
	}
	p, _ = parseSearch(httptest.NewRequest("GET", "/?q=Groceries&offset=100&limit=50&min_amount=12&max_amount=13", nil))
	result, err = s.SearchTransactions(ctx, p)
	if err != nil {
		t.Fatal(err)
	}
	json.Unmarshal(result, &data)
	if data.Total != 125 || len(data.Items) != 25 {
		t.Fatalf("pagination: %s", result)
	}
	other, otherCtx, _ := integrationService(t)
	result, err = other.SearchTransactions(otherCtx, p)
	if err != nil {
		t.Fatal(err)
	}
	json.Unmarshal(result, &data)
	if data.Total != 0 {
		t.Fatalf("leaked another user's history: %s", result)
	}
}

func TestIntegrationRecurringConcurrencyAndControls(t *testing.T) {
	s, ctx, cat := integrationService(t)
	start := time.Now().UTC().AddDate(0, 0, -4)
	pe, err := s.CreatePeriodicExpense(ctx, createPeriodicExpenseParams{Name: "Daily", Amount: 10, CategoryID: cat, PeriodInterval: 1, PeriodUnit: "days", StartDate: &start})
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); errs <- s.checkAndGeneratePeriodicExpenses(ctx, pe.UserID) }()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	expenses, err := s.ListExpenses(ctx, 100, 0)
	if err != nil || len(expenses) != 5 {
		t.Fatalf("expected 5 unique occurrences; got %d, %v", len(expenses), err)
	}
	schedules, err := s.ListPeriodicExpenses(ctx)
	if err != nil {
		t.Fatal(err)
	}
	due := schedules[0].NextDueDate.Time
	amount := 20.0
	updated, err := s.UpdatePeriodicExpense(ctx, updatePeriodicExpenseParams{ID: pe.ID, Amount: &amount})
	if err != nil || !updated.NextDueDate.Time.Equal(due) {
		t.Fatalf("edit moved due date: %+v %v", updated, err)
	}
	preview, err := s.UpcomingPayments(ctx)
	if err != nil || math.Abs(preview.Total7-140) > 0.001 || math.Abs(preview.Total30-600) > 0.001 {
		t.Fatalf("preview: %+v %v", preview, err)
	}
	skipped, err := s.PeriodicAction(ctx, pe.ID, "skip")
	if err != nil || !skipped.NextDueDate.Time.Equal(due.AddDate(0, 0, 1)) {
		t.Fatalf("skip: %+v %v", skipped, err)
	}
	if _, err = s.PeriodicAction(ctx, pe.ID, "pause"); err != nil {
		t.Fatal(err)
	}
	// Simulate time passing while paused.
	pool := s.db.(*pgxpool.Pool)
	_, err = pool.Exec(ctx, "UPDATE periodic_expenses SET next_due_date=$1 WHERE id=$2", start, pe.ID)
	if err != nil {
		t.Fatal(err)
	}
	preview, err = s.UpcomingPayments(ctx)
	if err != nil || preview.Total30 != 0 {
		t.Fatalf("paused schedule in preview: %+v %v", preview, err)
	}
	resumed, err := s.PeriodicAction(ctx, pe.ID, "resume")
	if err != nil || !resumed.NextDueDate.Time.After(time.Now()) {
		t.Fatalf("resume: %+v %v", resumed, err)
	}
	expenses, err = s.ListExpenses(ctx, 100, 0)
	if err != nil || len(expenses) != 5 {
		t.Fatalf("pause was backfilled: %d %v", len(expenses), err)
	}
	for _, e := range expenses {
		if e.Amount != 10 {
			t.Fatal("edited historical amount")
		}
	}
	_, otherCtx, _ := integrationService(t)
	if _, err = s.PeriodicAction(otherCtx, pe.ID, "pause"); err == nil {
		t.Fatal("modified another user's schedule")
	}
}

func TestIntegrationRecurringRollback(t *testing.T) {
	s, ctx, cat := integrationService(t)
	start := time.Now().UTC().AddDate(0, 0, -2)
	pe, err := s.CreatePeriodicExpense(ctx, createPeriodicExpenseParams{Name: "Rollback", Amount: 10, CategoryID: cat, PeriodInterval: 1, PeriodUnit: "days", StartDate: &start})
	if err != nil {
		t.Fatal(err)
	}
	// Force a failure after inserting and advancing the first occurrence.
	sentinel := fmt.Errorf("simulated failure")
	err = s.transaction(ctx, func(q repo.Querier) error {
		locked, err := q.LockPeriodicExpense(ctx, repo.LockPeriodicExpenseParams{ID: pe.ID, UserID: pe.UserID})
		if err != nil {
			return err
		}
		if err = generateDue(ctx, q, &locked, start); err != nil {
			return err
		}
		return sentinel
	})
	if err != sentinel {
		t.Fatal(err)
	}
	var count int
	pool := s.db.(*pgxpool.Pool)
	if err = pool.QueryRow(ctx, "SELECT count(*) FROM expenses WHERE user_id=$1", pe.UserID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	var due time.Time
	if err = pool.QueryRow(ctx, "SELECT next_due_date FROM periodic_expenses WHERE id=$1", pe.ID).Scan(&due); err != nil {
		t.Fatal(err)
	}
	if count != 0 || !due.Equal(start.Truncate(time.Microsecond)) {
		t.Fatalf("rollback failed: count=%d due=%v start=%v", count, due, start)
	}
}

func TestIntegrationSearchFiltersAndTies(t *testing.T) {
	s, ctx, cat := integrationService(t)
	date := time.Date(2024, 2, 29, 12, 0, 0, 0, time.UTC)
	for _, name := range []string{"First", "Second"} {
		if _, err := s.CreateExpense(ctx, createExpenseParams{Name: name, Amount: 12.5, CategoryID: cat, SpentOn: &date}); err != nil {
			t.Fatal(err)
		}
	}
	incomeCat, err := s.CreateCategory(ctx, createCategoryParams{Name: "Salary", Type: "income"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.CreateIncome(ctx, createIncomeParams{Name: "Salary", Amount: 30, CategoryID: incomeCat.ID, ReceivedOn: &date}); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		query string
		total int
		names []string
	}{
		{"from=2024-02-29&to=2024-02-29&limit=2", 3, []string{"Second", "First"}},
		{"from=2024-02-29&to=2024-02-29&limit=2&offset=2", 3, []string{"Salary"}},
		{"from=2024-02-29&to=2024-02-29&limit=2&offset=4", 3, []string{}},
		{"type=income&min_amount=20&max_amount=40", 1, []string{"Salary"}},
		{fmt.Sprintf("category_id=%d&q=12.5", cat), 2, []string{"Second", "First"}},
		{"q=%25", 0, []string{}},
		{"from=2024-03-01", 0, []string{}},
	} {
		p, err := parseSearch(httptest.NewRequest("GET", "/?"+tc.query, nil))
		if err != nil {
			t.Fatal(err)
		}
		raw, err := s.SearchTransactions(ctx, p)
		if err != nil {
			t.Fatal(err)
		}
		var result struct {
			Total int
			Items []struct{ Name string }
		}
		if err = json.Unmarshal(raw, &result); err != nil {
			t.Fatal(err)
		}
		if result.Total != tc.total || len(result.Items) != len(tc.names) {
			t.Fatalf("%s: %s", tc.query, raw)
		}
		for i, name := range tc.names {
			if result.Items[i].Name != name {
				t.Fatalf("%s: %s", tc.query, raw)
			}
		}
	}
	if _, err = s.CreateExpense(ctx, createExpenseParams{Name: "Bad type", Amount: 1, CategoryID: incomeCat.ID, SpentOn: &date}); err == nil {
		t.Fatal("accepted income category for expense")
	}
}
