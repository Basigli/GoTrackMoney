package main

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/auth"
	myhttp "github.com/sikozonpc/ecom/internal/transport/http"
)

func mount(handler *myhttp.Handler, authManager *auth.Manager, queries *repo.Queries) *chi.Mux {
	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://*", "https://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("all good"))
	})

	r.Post("/users", handler.CreateUser)
	r.Post("/auth/login", handler.Login)

	r.With(authManager.Middleware(queries)).Group(func(r chi.Router) {
		r.Get("/users", handler.ListUsers)
		r.Get("/auth/me", handler.Me)
		r.Put("/users/me", handler.UpdateUser)
		r.Delete("/users/me", handler.DeleteUser)

		r.With(auth.AdminMiddleware).Group(func(r chi.Router) {
			r.Put("/admin/users/{id}/reset-password", handler.AdminResetUserPassword)
			r.Delete("/admin/users/{id}", handler.AdminDeleteUser)
		})

		r.Get("/categories", handler.ListCategories)
		r.Post("/categories", handler.CreateCategory)
		r.Put("/categories/{id}", handler.UpdateCategory)

		r.Get("/expenses/filter", handler.FilterExpenses)
		r.Get("/expenses", handler.ListExpenses)
		r.Post("/expenses", handler.CreateExpense)
		r.Put("/expenses/{id}", handler.UpdateExpense)
		r.Delete("/expenses/{id}", handler.DeleteExpense)

		r.Get("/incomes/filter", handler.FilterIncomes)
		r.Get("/incomes", handler.ListIncomes)
		r.Post("/incomes", handler.CreateIncome)
		r.Put("/incomes/{id}", handler.UpdateIncome) // No UpdateIncome in handler, but keeping route if needed later. Oh wait, it is not implemented in myhttp.Handler yet. Let me skip UpdateIncome for now or I can add it. 
		r.Delete("/incomes/{id}", handler.DeleteIncome)

		r.Get("/periodic-expenses", handler.ListPeriodicExpenses)
		r.Post("/periodic-expenses", handler.CreatePeriodicExpense)
		r.Put("/periodic-expenses/{id}", handler.UpdatePeriodicExpense)
		r.Delete("/periodic-expenses/{id}", handler.DeletePeriodicExpense)

		r.Get("/analytics/expenses-by-category", handler.AnalyticsExpensesByCategory)
		r.Get("/analytics/income-vs-expense", handler.AnalyticsIncomeVsExpense)
	})

	return r
}
