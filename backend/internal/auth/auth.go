package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
)

var ErrUnauthorized = errors.New("unauthorized")

type contextKey struct{}

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
}

type UserReader interface {
	FindUserByID(context.Context, int64) (repo.User, error)
}

type Manager struct {
	secret []byte
	ttl    time.Duration
}

type claims struct {
	UserID    int64 `json:"user_id"`
	ExpiresAt int64 `json:"expires_at"`
}

func NewManager(secret string, ttl time.Duration) *Manager {
	return &Manager{
		secret: []byte(secret),
		ttl:    ttl,
	}
}

func (m *Manager) Issue(userID int64, ttl time.Duration) (string, error) {
	if ttl == 0 {
		ttl = m.ttl
	}
	payload, err := json.Marshal(claims{
		UserID:    userID,
		ExpiresAt: time.Now().UTC().Add(ttl).Unix(),
	})
	if err != nil {
		return "", err
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, m.secret)
	_, _ = mac.Write([]byte(encodedPayload))

	token := encodedPayload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return token, nil
}

func (m *Manager) Validate(token string) (int64, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return 0, ErrUnauthorized
	}

	mac := hmac.New(sha256.New, m.secret)
	_, _ = mac.Write([]byte(parts[0]))
	expectedSig := mac.Sum(nil)

	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(sig, expectedSig) {
		return 0, ErrUnauthorized
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return 0, ErrUnauthorized
	}

	var c claims
	if err := json.Unmarshal(payload, &c); err != nil {
		return 0, ErrUnauthorized
	}
	if c.UserID <= 0 || time.Now().UTC().Unix() > c.ExpiresAt {
		return 0, ErrUnauthorized
	}

	return c.UserID, nil
}

func (m *Manager) Middleware(reader UserReader) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, err := bearerToken(r.Header.Get("Authorization"))
			if err != nil {
				unauthorized(w)
				return
			}

			userID, err := m.Validate(token)
			if err != nil {
				unauthorized(w)
				return
			}

			user, err := reader.FindUserByID(r.Context(), userID)
			if err != nil {
				unauthorized(w)
				return
			}

			ctx := WithUser(r.Context(), User{
				ID:       user.ID,
				Username: user.Username,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func WithUser(ctx context.Context, user User) context.Context {
	return context.WithValue(ctx, contextKey{}, user)
}

func CurrentUser(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(contextKey{}).(User)
	return user, ok
}

func bearerToken(value string) (string, error) {
	if value == "" {
		return "", ErrUnauthorized
	}

	scheme, token, ok := strings.Cut(value, " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") || token == "" {
		return "", ErrUnauthorized
	}

	return token, nil
}

func unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", "Bearer")
	http.Error(w, ErrUnauthorized.Error(), http.StatusUnauthorized)
}

func UsernameFromContext(ctx context.Context) (string, bool) {
	user, ok := CurrentUser(ctx)
	if !ok {
		return "", false
	}
	return user.Username, true
}

func UserIDFromContext(ctx context.Context) (int64, bool) {
	user, ok := CurrentUser(ctx)
	if !ok {
		return 0, false
	}
	return user.ID, true
}
