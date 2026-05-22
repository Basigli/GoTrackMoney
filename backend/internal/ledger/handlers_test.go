package ledger

import (
	"bytes"
	"context"
	stdjson "encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/auth"
)

type fakeService struct {
	authenticateUser func(context.Context, loginParams) (repo.User, error)
}

func (f *fakeService) ListUsers(context.Context) ([]repo.User, error) { return nil, nil }

func (f *fakeService) CreateUser(context.Context, createUserParams) (repo.User, error) {
	return repo.User{}, nil
}

func (f *fakeService) AuthenticateUser(ctx context.Context, params loginParams) (repo.User, error) {
	return f.authenticateUser(ctx, params)
}

func (f *fakeService) ListCategories(context.Context) ([]repo.Category, error) { return nil, nil }

func (f *fakeService) CreateCategory(context.Context, createCategoryParams) (repo.Category, error) {
	return repo.Category{}, nil
}

func (f *fakeService) ListExpenses(context.Context) ([]repo.Expense, error) { return nil, nil }

func (f *fakeService) CreateExpense(context.Context, createExpenseParams) (repo.Expense, error) {
	return repo.Expense{}, nil
}

func (f *fakeService) ListIncomes(context.Context) ([]repo.Income, error) { return nil, nil }

func (f *fakeService) CreateIncome(context.Context, createIncomeParams) (repo.Income, error) {
	return repo.Income{}, nil
}

type fakeUserReader struct {
	user repo.User
	err  error
}

func (f fakeUserReader) FindUserByID(context.Context, int64) (repo.User, error) {
	return f.user, f.err
}

func TestLoginEndpointIssuesToken(t *testing.T) {
	authManager := auth.NewManager("test-secret", time.Hour)
	svc := &fakeService{
		authenticateUser: func(ctx context.Context, params loginParams) (repo.User, error) {
			if params.Username != "alice" || params.Password != "secret" {
				t.Fatalf("unexpected credentials: %#v", params)
			}
			return repo.User{ID: 7, Username: "alice", Password: "hashed"}, nil
		},
	}

	h := NewHandler(svc, authManager)

	body := bytes.NewBufferString(`{"username":"alice","password":"secret"}`)
	req := httptest.NewRequest(http.MethodPost, "/auth/login", body)
	rec := httptest.NewRecorder()

	r := chi.NewRouter()
	r.Post("/auth/login", h.Login)
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var resp authResponse
	if err := stdjson.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if resp.User.ID != 7 || resp.User.Username != "alice" {
		t.Fatalf("unexpected user response: %#v", resp.User)
	}
	if resp.Token == "" {
		t.Fatal("expected token")
	}

	userID, err := authManager.Validate(resp.Token)
	if err != nil {
		t.Fatalf("validate token: %v", err)
	}
	if userID != 7 {
		t.Fatalf("expected user id 7, got %d", userID)
	}
}

func TestAuthMiddlewareProtectsMeEndpoint(t *testing.T) {
	authManager := auth.NewManager("test-secret", time.Hour)
	reader := fakeUserReader{
		user: repo.User{ID: 42, Username: "alice"},
	}
	h := NewHandler(&fakeService{}, authManager)

	r := chi.NewRouter()
	r.With(authManager.Middleware(reader)).Get("/auth/me", h.Me)

	t.Run("rejects missing token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected status 401, got %d", rec.Code)
		}
	})

	t.Run("allows valid token", func(t *testing.T) {
		token, err := authManager.Issue(42)
		if err != nil {
			t.Fatalf("issue token: %v", err)
		}

		req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()

		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", rec.Code)
		}

		var resp userResponse
		if err := stdjson.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if resp.ID != 42 || resp.Username != "alice" {
			t.Fatalf("unexpected response: %#v", resp)
		}
	})
}
