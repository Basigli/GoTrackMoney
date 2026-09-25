package ledger

import (
	"context"
	stdjson "encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/auth"
	"github.com/sikozonpc/ecom/internal/json"
)

func parseSearch(r *http.Request) (p repo.SearchTransactionsParams, err error) {
	v := r.URL.Query()
	p = repo.SearchTransactionsParams{PageLimit: 50, MaxAmount: math.MaxFloat64, ExactAmount: -1, Kind: v.Get("type"), Query: strings.TrimSpace(v.Get("q"))}
	if p.Kind != "" && p.Kind != "expense" && p.Kind != "income" {
		return p, fmt.Errorf("invalid type")
	}
	for _, field := range []string{"limit", "offset", "category_id"} {
		if v.Get(field) == "" {
			continue
		}
		n, e := strconv.ParseInt(v.Get(field), 10, 32)
		if e != nil || n < 0 || (field != "offset" && n == 0) || (field == "limit" && n > 100) {
			return p, fmt.Errorf("invalid %s", field)
		}
		switch field {
		case "limit":
			p.PageLimit = int32(n)
		case "offset":
			p.PageOffset = int32(n)
		case "category_id":
			p.Category = n
		}
	}
	for _, field := range []string{"min_amount", "max_amount"} {
		if v.Get(field) == "" {
			continue
		}
		n, e := strconv.ParseFloat(strings.ReplaceAll(v.Get(field), ",", "."), 64)
		if e != nil || n < 0 || math.IsNaN(n) || math.IsInf(n, 0) {
			return p, fmt.Errorf("invalid %s", field)
		}
		if field == "min_amount" {
			p.MinAmount = n
		} else {
			p.MaxAmount = n
		}
	}
	if p.MinAmount > p.MaxAmount {
		return p, fmt.Errorf("minimum amount exceeds maximum")
	}
	if n, e := strconv.ParseFloat(strings.ReplaceAll(p.Query, ",", "."), 64); e == nil && !math.IsNaN(n) && !math.IsInf(n, 0) {
		p.ExactAmount = n
	}
	for _, field := range []string{"from", "to"} {
		if v.Get(field) == "" {
			continue
		}
		date, e := time.Parse(time.DateOnly, v.Get(field))
		if e != nil {
			return p, fmt.Errorf("invalid %s date", field)
		}
		if field == "from" {
			p.DateFrom = timestamptzFromTime(&date)
		} else {
			date = date.AddDate(0, 0, 1) // UI end date is inclusive; SQL uses an exclusive bound.
			p.DateTo = timestamptzFromTime(&date)
		}
	}
	if p.DateFrom.Valid && p.DateTo.Valid && !p.DateFrom.Time.Before(p.DateTo.Time) {
		return p, fmt.Errorf("invalid date range")
	}
	return p, nil
}
func (s *svc) SearchTransactions(ctx context.Context, p repo.SearchTransactionsParams) (stdjson.RawMessage, error) {
	user, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	p.UserID = user.ID
	if err = s.checkAndGeneratePeriodicExpenses(ctx, user.ID); err != nil {
		return nil, err
	}
	return s.repo.SearchTransactions(ctx, p)
}
func writeServiceError(w http.ResponseWriter, err error) {
	status := http.StatusBadRequest
	if errors.Is(err, auth.ErrUnauthorized) {
		status = http.StatusUnauthorized
	}
	if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, ErrCategoryNotFound) {
		status = http.StatusNotFound
	}
	http.Error(w, err.Error(), status)
}
func (h *handler) SearchTransactions(w http.ResponseWriter, r *http.Request) {
	p, err := parseSearch(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	result, err := h.service.SearchTransactions(r.Context(), p)
	if err != nil {
		http.Error(w, "Unable to load transactions", http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, result)
}
func (h *handler) PeriodicAction(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	result, err := h.service.PeriodicAction(r.Context(), id, chi.URLParam(r, "action"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	json.Write(w, http.StatusOK, result)
}
func (h *handler) UpcomingPayments(w http.ResponseWriter, r *http.Request) {
	result, err := h.service.UpcomingPayments(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	json.Write(w, http.StatusOK, result)
}
