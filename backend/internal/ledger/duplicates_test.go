package ledger

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/auth"
)

func TestExpenseDayBounds(t *testing.T) {
	for _, tc := range []struct{ name, date, zone, start, end string }{
		{"UTC default", "2026-03-29T23:30:00Z", "", "2026-03-29T00:00:00Z", "2026-03-30T00:00:00Z"},
		{"local day differs from UTC", "2026-06-30T22:30:00Z", "Europe/Rome", "2026-06-30T22:00:00Z", "2026-07-01T22:00:00Z"},
		{"spring DST", "2026-03-29T12:00:00Z", "Europe/Rome", "2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z"},
		{"autumn DST", "2026-10-25T12:00:00Z", "Europe/Rome", "2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z"},
		{"negative offset", "2026-06-30T02:00:00Z", "America/New_York", "2026-06-29T04:00:00Z", "2026-06-30T04:00:00Z"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			date, _ := time.Parse(time.RFC3339, tc.date)
			start, end, reference, err := expenseDayBounds(&date, tc.zone)
			if err != nil || start.UTC().Format(time.RFC3339) != tc.start || end.UTC().Format(time.RFC3339) != tc.end || !reference.Equal(date) {
				t.Fatalf("unexpected bounds %v %v %v: %v", start, end, reference, err)
			}
		})
	}
	if _, _, _, err := expenseDayBounds(nil, "not/a/timezone"); err == nil {
		t.Fatal("accepted an invalid timezone")
	}
	start, end, date, err := expenseDayBounds(nil, "UTC")
	if err != nil || date.Before(start) || !date.Before(end) || time.Since(date) > time.Second {
		t.Fatalf("missing date should check today: %v %v %v %v", start, end, date, err)
	}
}

type duplicateRepository struct {
	repo.Querier
	rows       []repo.FindDuplicateExpensesRow
	queryError error
	query      *repo.FindDuplicateExpensesParams
	inserted   []repo.CreateExpenseParams
}

func (*duplicateRepository) FindCategoryByIDAndCreatorID(_ context.Context, p repo.FindCategoryByIDAndCreatorIDParams) (repo.Category, error) {
	return repo.Category{ID: p.ID, CreatorID: p.CreatorID, Type: "expense"}, nil
}

func (r *duplicateRepository) FindDuplicateExpenses(_ context.Context, p repo.FindDuplicateExpensesParams) ([]repo.FindDuplicateExpensesRow, error) {
	r.query = &p
	return r.rows, r.queryError
}

func (r *duplicateRepository) CreateExpense(_ context.Context, p repo.CreateExpenseParams) (repo.Expense, error) {
	r.inserted = append(r.inserted, p)
	return repo.Expense{ID: 10, Amount: p.Amount, CategoryID: p.CategoryID, UserID: p.UserID}, nil
}

func TestCreateExpenseDuplicateReview(t *testing.T) {
	date := time.Date(2026, 6, 30, 22, 30, 0, 0, time.UTC)
	ctx := auth.WithUser(context.Background(), auth.User{ID: 7})
	params := createExpenseParams{Name: "Food", Description: "Dinner", Amount: 20, CategoryID: 3, SpentOn: &date, Timezone: "Europe/Rome"}
	rows := []repo.FindDuplicateExpensesRow{{ID: 1, Name: "Coffee", Description: "Other wording", Amount: 20,
		CategoryID: 8, CategoryName: "Dining", CategoryEmoji: "x", SpentOn: pgtype.Timestamptz{Time: date, Valid: true}, IsPeriodic: true, TotalCount: 9}}

	t.Run("review inserts nothing", func(t *testing.T) {
		r := &duplicateRepository{rows: rows}
		_, err := (&svc{repo: r}).CreateExpense(ctx, params)
		var review *duplicateExpenseError
		if !errors.As(err, &review) || review.Total != 9 || len(review.Matches) != 1 || len(r.inserted) != 0 {
			t.Fatalf("expected review without insertion: %v, inserts: %v", err, r.inserted)
		}
		if review.Matches[0].CategoryID != 8 || !review.Matches[0].IsPeriodic || !review.Matches[0].SpentOn.Equal(date) {
			t.Fatalf("lost match details: %+v", review.Matches[0])
		}
		if r.query.UserID != 7 || r.query.CategoryID != 3 || r.query.Description != "Dinner" || r.query.DayStart.Time.UTC().Format(time.RFC3339) != "2026-06-30T22:00:00Z" {
			t.Fatalf("wrong query: %+v", r.query)
		}
	})
	t.Run("no matches saves normally", func(t *testing.T) {
		r := &duplicateRepository{}
		_, err := (&svc{repo: r}).CreateExpense(ctx, params)
		if err != nil || len(r.inserted) != 1 || r.inserted[0].UserID != 7 {
			t.Fatalf("normal creation failed: %v", err)
		}
	})
	t.Run("explicit override saves once", func(t *testing.T) {
		r := &duplicateRepository{rows: rows}
		p := params
		p.AllowDuplicate = true
		_, err := (&svc{repo: r}).CreateExpense(ctx, p)
		if err != nil || len(r.inserted) != 1 || r.query != nil {
			t.Fatalf("override failed: %v", err)
		}
	})
	t.Run("query failure inserts nothing", func(t *testing.T) {
		r := &duplicateRepository{queryError: errors.New("database unavailable")}
		_, err := (&svc{repo: r}).CreateExpense(ctx, params)
		if err == nil || len(r.inserted) != 0 {
			t.Fatal("saved after failing to check for duplicates")
		}
	})
	t.Run("invalid timezone inserts nothing", func(t *testing.T) {
		r := &duplicateRepository{}
		p := params
		p.Timezone = "invalid"
		_, err := (&svc{repo: r}).CreateExpense(ctx, p)
		if err == nil || len(r.inserted) != 0 || r.query != nil {
			t.Fatal("saved with invalid timezone")
		}
	})
}

type duplicateHandlerService struct {
	Service
	params createExpenseParams
}

func (s *duplicateHandlerService) CreateExpense(_ context.Context, p createExpenseParams) (repo.Expense, error) {
	s.params = p
	if p.AllowDuplicate {
		return repo.Expense{ID: 10}, nil
	}
	return repo.Expense{}, &duplicateExpenseError{Total: 1, Matches: []duplicateExpenseMatch{{ID: 1, Amount: 20}}}
}

func TestCreateExpenseConflictResponse(t *testing.T) {
	s := &duplicateHandlerService{}
	h := &handler{service: s}
	response := httptest.NewRecorder()
	h.CreateExpense(response, httptest.NewRequest(http.MethodPost, "/expenses", strings.NewReader(`{"name":"Food","amount":20,"category_id":3,"timezone":"Europe/Rome"}`)))
	var body struct {
		Code    string                  `json:"code"`
		Matches []duplicateExpenseMatch `json:"matches"`
		Total   int64                   `json:"total"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || response.Code != http.StatusConflict || body.Code != "possible_duplicate" || body.Total != 1 || len(body.Matches) != 1 {
		t.Fatalf("unexpected response %d %s: %v", response.Code, response.Body.String(), err)
	}
	if s.params.Timezone != "Europe/Rome" {
		t.Fatal("timezone was not decoded")
	}
	response = httptest.NewRecorder()
	h.CreateExpense(response, httptest.NewRequest(http.MethodPost, "/expenses", strings.NewReader(`{"name":"Food","amount":20,"category_id":3,"allow_duplicate":true}`)))
	if response.Code != http.StatusCreated || !s.params.AllowDuplicate {
		t.Fatalf("override failed: %d %s", response.Code, response.Body.String())
	}
}
