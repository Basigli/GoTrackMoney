package http

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/sikozonpc/ecom/internal/auth"
	"github.com/sikozonpc/ecom/internal/core"
	"github.com/sikozonpc/ecom/internal/json"
	"github.com/sikozonpc/ecom/internal/service"
)

type Handler struct {
	userSvc       service.UserService
	catSvc        service.CategoryService
	txSvc         service.TransactionService
	analyticsSvc  service.AnalyticsService
	authManager   *auth.Manager
}

func NewHandler(
	userSvc service.UserService,
	catSvc service.CategoryService,
	txSvc service.TransactionService,
	analyticsSvc service.AnalyticsService,
	authManager *auth.Manager,
) *Handler {
	return &Handler{
		userSvc:       userSvc,
		catSvc:        catSvc,
		txSvc:         txSvc,
		analyticsSvc:  analyticsSvc,
		authManager:   authManager,
	}
}

// User Handlers
type userResponse struct {
	ID                   int64  `json:"id"`
	Username             string `json:"username"`
	SessionDurationHours int32  `json:"session_duration_hours"`
	IsAdmin              bool   `json:"is_admin"`
}

type authResponse struct {
	User  userResponse `json:"user"`
	Token string       `json:"token"`
}

func toUserResponse(user core.User) userResponse {
	return userResponse{
		ID:                   user.ID,
		Username:             user.Username,
		SessionDurationHours: user.SessionDurationHours,
		IsAdmin:              user.IsAdmin,
	}
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.userSvc.CreateUser(r.Context(), payload.Username, payload.Password)
	if err != nil {
		if errors.Is(err, service.ErrUsernameTaken) {
			http.Error(w, err.Error(), http.StatusConflict)
		} else {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
		return
	}

	token, err := h.authManager.Issue(user.ID, time.Duration(user.SessionDurationHours)*time.Hour)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.Write(w, http.StatusCreated, authResponse{
		User:  toUserResponse(user),
		Token: token,
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.userSvc.AuthenticateUser(r.Context(), payload.Username, payload.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	token, err := h.authManager.Issue(user.ID, time.Duration(user.SessionDurationHours)*time.Hour)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.Write(w, http.StatusOK, authResponse{
		User:  toUserResponse(user),
		Token: token,
	})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.CurrentUser(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	json.Write(w, http.StatusOK, userResponse{
		ID:       user.ID,
		Username: user.Username,
		IsAdmin:  user.IsAdmin,
	})
}

// Category Handlers
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	cats, err := h.catSvc.ListCategories(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, cats)
}

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var payload struct {
		Name  string `json:"name"`
		Emoji string `json:"emoji"`
		Type  string `json:"type"`
		Color string `json:"color"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cat, err := h.catSvc.CreateCategory(r.Context(), userID, payload.Name, payload.Emoji, payload.Type, payload.Color)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.Write(w, http.StatusCreated, cat)
}

func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var payload struct {
		Name  string `json:"name"`
		Emoji string `json:"emoji"`
		Type  string `json:"type"`
		Color string `json:"color"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cat, err := h.catSvc.UpdateCategory(r.Context(), userID, id, payload.Name, payload.Emoji, payload.Type, payload.Color)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.Write(w, http.StatusOK, cat)
}

// Transaction Handlers
func parsePagination(r *http.Request) (int32, int32) {
	limit, offset := int32(100), int32(0)
	if l, err := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 32); err == nil {
		limit = int32(l)
	}
	if o, err := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 32); err == nil {
		offset = int32(o)
	}
	return limit, offset
}

func (h *Handler) ListExpenses(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	limit, offset := parsePagination(r)
	expenses, err := h.txSvc.ListExpenses(r.Context(), userID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, expenses)
}

func (h *Handler) CreateExpense(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var payload struct {
		Name        string     `json:"name"`
		Description string     `json:"description"`
		Amount      float64    `json:"amount"`
		CategoryID  int64      `json:"category_id"`
		SpentOn     *time.Time `json:"spent_on"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	spentOn := time.Now()
	if payload.SpentOn != nil {
		spentOn = *payload.SpentOn
	}

	exp, err := h.txSvc.CreateExpense(r.Context(), userID, payload.Name, payload.Description, payload.Amount, payload.CategoryID, spentOn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.Write(w, http.StatusCreated, exp)
}

func (h *Handler) UpdateExpense(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var payload struct {
		Name        string     `json:"name"`
		Description string     `json:"description"`
		Amount      float64    `json:"amount"`
		CategoryID  int64      `json:"category_id"`
		SpentOn     *time.Time `json:"spent_on"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	spentOn := time.Now()
	if payload.SpentOn != nil {
		spentOn = *payload.SpentOn
	}

	exp, err := h.txSvc.UpdateExpense(r.Context(), userID, id, payload.Name, payload.Description, payload.Amount, payload.CategoryID, spentOn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.Write(w, http.StatusOK, exp)
}

func (h *Handler) DeleteExpense(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.txSvc.DeleteExpense(r.Context(), userID, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseDateFilter(r *http.Request) (time.Time, time.Time, error) {
	yearStr := r.URL.Query().Get("year")
	monthStr := r.URL.Query().Get("month")
	if yearStr == "" {
		return time.Time{}, time.Time{}, errors.New("year is required")
	}
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("invalid year")
	}

	var start, end time.Time
	if monthStr != "" && monthStr != "0" {
		month, err := strconv.Atoi(monthStr)
		if err != nil {
			return time.Time{}, time.Time{}, errors.New("invalid month")
		}
		start = time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 1, 0)
	} else {
		start = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(1, 0, 0)
	}
	return start, end, nil
}

func (h *Handler) FilterExpenses(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	start, end, err := parseDateFilter(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	expenses, err := h.txSvc.FilterExpenses(r.Context(), userID, start, end)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if expenses == nil {
		expenses = []core.Expense{}
	}
	json.Write(w, http.StatusOK, expenses)
}

// Incomes (Simplified - we'd normally have full CRUD here similar to expenses)
func (h *Handler) ListIncomes(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	limit, offset := parsePagination(r)
	incomes, err := h.txSvc.ListIncomes(r.Context(), userID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, incomes)
}

func (h *Handler) CreateIncome(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var payload struct {
		Name        string     `json:"name"`
		Description string     `json:"description"`
		Amount      float64    `json:"amount"`
		CategoryID  int64      `json:"category_id"`
		ReceivedOn  *time.Time `json:"received_on"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	receivedOn := time.Now()
	if payload.ReceivedOn != nil {
		receivedOn = *payload.ReceivedOn
	}

	inc, err := h.txSvc.CreateIncome(r.Context(), userID, payload.Name, payload.Description, payload.Amount, payload.CategoryID, receivedOn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.Write(w, http.StatusCreated, inc)
}

func (h *Handler) UpdateIncome(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var payload struct {
		Name        string     `json:"name"`
		Description string     `json:"description"`
		Amount      float64    `json:"amount"`
		CategoryID  int64      `json:"category_id"`
		ReceivedOn  *time.Time `json:"received_on"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	receivedOn := time.Now()
	if payload.ReceivedOn != nil {
		receivedOn = *payload.ReceivedOn
	}

	inc, err := h.txSvc.UpdateIncome(r.Context(), userID, id, payload.Name, payload.Description, payload.Amount, payload.CategoryID, receivedOn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.Write(w, http.StatusOK, inc)
}

func (h *Handler) FilterIncomes(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	start, end, err := parseDateFilter(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	incomes, err := h.txSvc.FilterIncomes(r.Context(), userID, start, end)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if incomes == nil {
		incomes = []core.Income{}
	}
	json.Write(w, http.StatusOK, incomes)
}

func (h *Handler) DeleteIncome(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.txSvc.DeleteIncome(r.Context(), userID, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


// Periodic Expenses
func (h *Handler) ListPeriodicExpenses(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	expenses, err := h.txSvc.ListPeriodicExpenses(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, expenses)
}

func (h *Handler) CreatePeriodicExpense(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var payload struct {
		Name           string     `json:"name"`
		Description    string     `json:"description"`
		Amount         float64    `json:"amount"`
		CategoryID     int64      `json:"category_id"`
		PeriodInterval int32      `json:"period_interval"`
		PeriodUnit     string     `json:"period_unit"`
		StartDate      *time.Time `json:"start_date"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	exp, err := h.txSvc.CreatePeriodicExpense(r.Context(), userID, payload.Name, payload.Description, payload.Amount, payload.CategoryID, payload.PeriodInterval, payload.PeriodUnit, payload.StartDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.Write(w, http.StatusCreated, exp)
}

func (h *Handler) UpdatePeriodicExpense(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var payload struct {
		PeriodInterval int32      `json:"period_interval"`
		PeriodUnit     string     `json:"period_unit"`
		NextDueDate    *time.Time `json:"next_due_date"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	exp, err := h.txSvc.UpdatePeriodicExpense(r.Context(), userID, id, payload.PeriodInterval, payload.PeriodUnit, payload.NextDueDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.Write(w, http.StatusOK, exp)
}

func (h *Handler) DeletePeriodicExpense(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.txSvc.DeletePeriodicExpense(r.Context(), userID, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Analytics
func (h *Handler) AnalyticsExpensesByCategory(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	yearStr := r.URL.Query().Get("year")
	monthStr := r.URL.Query().Get("month")
	year, _ := strconv.Atoi(yearStr)
	month, _ := strconv.Atoi(monthStr) // will be 0 if empty

	if year == 0 {
		http.Error(w, "year is required", http.StatusBadRequest)
		return
	}

	totals, err := h.analyticsSvc.GetExpensesByCategory(r.Context(), userID, year, month)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if totals == nil {
		totals = []core.ExpenseByCategory{}
	}
	json.Write(w, http.StatusOK, totals)
}

func (h *Handler) AnalyticsIncomeVsExpense(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	yearStr := r.URL.Query().Get("year")
	monthStr := r.URL.Query().Get("month")
	year, err1 := strconv.Atoi(yearStr)
	month, err2 := strconv.Atoi(monthStr)

	if err1 != nil || err2 != nil {
		http.Error(w, "year and month are required", http.StatusBadRequest)
		return
	}

	incomes, expenses, err := h.analyticsSvc.GetIncomeVsExpense(r.Context(), userID, year, month)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if incomes == nil {
		incomes = []core.MonthlyTotal{}
	}
	if expenses == nil {
		expenses = []core.MonthlyTotal{}
	}

	json.Write(w, http.StatusOK, map[string]interface{}{
		"incomes":  incomes,
		"expenses": expenses,
	})
}

// Users Admin endpoints
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.userSvc.ListUsers(r.Context())
	if err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	var res []userResponse
	for _, u := range users {
		res = append(res, toUserResponse(u))
	}
	json.Write(w, http.StatusOK, res)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		Username             string `json:"username"`
		Password             string `json:"password"`
		SessionDurationHours int32  `json:"session_duration_hours"`
	}
	if err := json.Read(r, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.userSvc.UpdateUser(r.Context(), userID, payload.Username, payload.Password, payload.SessionDurationHours)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.Write(w, http.StatusOK, toUserResponse(user))
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if err := h.userSvc.DeleteUser(r.Context(), userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) AdminResetUserPassword(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	tempPassword, err := h.userSvc.AdminResetUserPassword(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, map[string]string{"temp_password": tempPassword})
}

func (h *Handler) AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.userSvc.DeleteUser(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.Write(w, http.StatusOK, map[string]string{"status": "ok"})
}
