package ledger

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/auth"
	"github.com/sikozonpc/ecom/internal/json"
)

type handler struct {
	service Service
	auth    *auth.Manager
}

type userResponse struct {
	ID                   int64  `json:"id"`
	Username             string `json:"username"`
	SessionDurationHours int32  `json:"session_duration_hours"`
}

type authResponse struct {
	User  userResponse `json:"user"`
	Token string       `json:"token"`
}

func NewHandler(service Service, authManager *auth.Manager) *handler {
	return &handler{service: service, auth: authManager}
}

func (h *handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.service.ListUsers(r.Context())
	if err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, toUserResponses(users))
}

func (h *handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var payload createUserParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	user, err := h.service.CreateUser(r.Context(), payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, ErrUsernameTaken):
			http.Error(w, err.Error(), http.StatusConflict)
		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}
	ttl := time.Duration(user.SessionDurationHours) * time.Hour
	token, err := h.auth.Issue(user.ID, ttl)
	if err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusCreated, authResponse{
		User:  toUserResponse(user),
		Token: token,
	})
}

func (h *handler) Login(w http.ResponseWriter, r *http.Request) {
	var payload loginParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.service.AuthenticateUser(r.Context(), payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, ErrInvalidCredentials):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	ttl := time.Duration(user.SessionDurationHours) * time.Hour
	token, err := h.auth.Issue(user.ID, ttl)
	if err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.Write(w, http.StatusOK, authResponse{
		User:  toUserResponse(user),
		Token: token,
	})
}

func (h *handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var payload updateUserParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.service.UpdateUser(r.Context(), userID, payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, ErrUsernameTaken):
			http.Error(w, err.Error(), http.StatusConflict)
		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}

	json.Write(w, http.StatusOK, toUserResponse(user))
}

func (h *handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if err := h.service.DeleteUser(r.Context(), userID); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.CurrentUser(r.Context())
	if !ok {
		http.Error(w, auth.ErrUnauthorized.Error(), http.StatusUnauthorized)
		return
	}

	json.Write(w, http.StatusOK, userResponse{
		ID:       user.ID,
		Username: user.Username,
	})
}

func (h *handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.service.ListCategories(r.Context())
	if err != nil {
		log.Println(err)
		if errors.Is(err, auth.ErrUnauthorized) {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, categories)
}

func (h *handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var payload createCategoryParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	category, err := h.service.CreateCategory(r.Context(), payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}
	json.Write(w, http.StatusCreated, category)
}

func (h *handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	var payload updateCategoryParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var id int64
	fmt.Sscanf(idStr, "%d", &id)
	payload.ID = id

	category, err := h.service.UpdateCategory(r.Context(), payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}
	json.Write(w, http.StatusOK, category)
}

func parsePagination(r *http.Request) (int32, int32) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	var limit, offset int32 = 100, 0
	if limitStr != "" {
		if l, err := strconv.ParseInt(limitStr, 10, 32); err == nil {
			limit = int32(l)
		}
	}
	if offsetStr != "" {
		if o, err := strconv.ParseInt(offsetStr, 10, 32); err == nil {
			offset = int32(o)
		}
	}
	return limit, offset
}

func (h *handler) ListExpenses(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)
	expenses, err := h.service.ListExpenses(r.Context(), limit, offset)
	if err != nil {
		log.Println(err)
		if errors.Is(err, auth.ErrUnauthorized) {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, expenses)
}

func (h *handler) CreateExpense(w http.ResponseWriter, r *http.Request) {
	var payload createExpenseParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	expense, err := h.service.CreateExpense(r.Context(), payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		case errors.Is(err, ErrCategoryNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}
	json.Write(w, http.StatusCreated, expense)
}

func (h *handler) UpdateExpense(w http.ResponseWriter, r *http.Request) {
	var payload updateExpenseParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var id int64
	fmt.Sscanf(idStr, "%d", &id)
	payload.ID = id

	expense, err := h.service.UpdateExpense(r.Context(), payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		case errors.Is(err, ErrCategoryNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}
	json.Write(w, http.StatusOK, expense)
}

func (h *handler) DeleteExpense(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var id int64
	fmt.Sscanf(idStr, "%d", &id)

	if err := h.service.DeleteExpense(r.Context(), id); err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) ListIncomes(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)
	incomes, err := h.service.ListIncomes(r.Context(), limit, offset)
	if err != nil {
		log.Println(err)
		if errors.Is(err, auth.ErrUnauthorized) {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, incomes)
}

func (h *handler) CreateIncome(w http.ResponseWriter, r *http.Request) {
	var payload createIncomeParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	income, err := h.service.CreateIncome(r.Context(), payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		case errors.Is(err, ErrCategoryNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}
	json.Write(w, http.StatusCreated, income)
}

func (h *handler) UpdateIncome(w http.ResponseWriter, r *http.Request) {
	var payload updateIncomeParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var id int64
	fmt.Sscanf(idStr, "%d", &id)
	payload.ID = id

	income, err := h.service.UpdateIncome(r.Context(), payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		case errors.Is(err, ErrCategoryNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}
	json.Write(w, http.StatusOK, income)
}

func (h *handler) DeleteIncome(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var id int64
	fmt.Sscanf(idStr, "%d", &id)

	if err := h.service.DeleteIncome(r.Context(), id); err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func toUserResponses(users []repo.User) []userResponse {
	responses := make([]userResponse, 0, len(users))
	for _, user := range users {
		responses = append(responses, toUserResponse(user))
	}
	return responses
}

func toUserResponse(user repo.User) userResponse {
	return userResponse{
		ID:                   user.ID,
		Username:             user.Username,
		SessionDurationHours: user.SessionDurationHours,
	}
}

func (h *handler) ListPeriodicExpenses(w http.ResponseWriter, r *http.Request) {
	expenses, err := h.service.ListPeriodicExpenses(r.Context())
	if err != nil {
		log.Println(err)
		if errors.Is(err, auth.ErrUnauthorized) {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, expenses)
}

func (h *handler) CreatePeriodicExpense(w http.ResponseWriter, r *http.Request) {
	var payload createPeriodicExpenseParams
	if err := json.Read(r, &payload); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	expense, err := h.service.CreatePeriodicExpense(r.Context(), payload)
	if err != nil {
		log.Println(err)
		switch {
		case errors.Is(err, auth.ErrUnauthorized):
			http.Error(w, err.Error(), http.StatusUnauthorized)
		case errors.Is(err, ErrCategoryNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		default:
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}
	json.Write(w, http.StatusCreated, expense)
}

func (h *handler) DeletePeriodicExpense(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var id int64
	fmt.Sscanf(idStr, "%d", &id)

	if err := h.service.DeletePeriodicExpense(r.Context(), id); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, map[string]string{"status": "ok"})
}
