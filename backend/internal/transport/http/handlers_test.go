package http

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
	"github.com/sikozonpc/ecom/internal/core"
)

type fakeUserService struct {
	authenticateUser func(ctx context.Context, username, password string) (core.User, error)
}

func (f *fakeUserService) ListUsers(ctx context.Context) ([]core.User, error) { return nil, nil }
func (f *fakeUserService) CreateUser(ctx context.Context, username, password string) (core.User, error) {
	return core.User{}, nil
}
func (f *fakeUserService) UpdateUser(ctx context.Context, id int64, username, password string, sessionDurationHours int32) (core.User, error) {
	return core.User{}, nil
}
func (f *fakeUserService) DeleteUser(ctx context.Context, id int64) error { return nil }
func (f *fakeUserService) AuthenticateUser(ctx context.Context, username, password string) (core.User, error) {
	return f.authenticateUser(ctx, username, password)
}
func (f *fakeUserService) AdminResetUserPassword(ctx context.Context, id int64) (string, error) {
	return "", nil
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
	svc := &fakeUserService{
		authenticateUser: func(ctx context.Context, username, password string) (core.User, error) {
			if username != "alice" || password != "secret" {
				t.Fatalf("unexpected credentials: %s / %s", username, password)
			}
			return core.User{ID: 7, Username: "alice", Password: "hashed"}, nil
		},
	}

	h := NewHandler(svc, nil, nil, nil, authManager)

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
	h := NewHandler(&fakeUserService{}, nil, nil, nil, authManager)

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
		token, err := authManager.Issue(42, 0)
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
