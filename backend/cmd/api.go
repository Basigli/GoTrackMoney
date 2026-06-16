package main

import (
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/auth"
	"github.com/sikozonpc/ecom/internal/ledger"
)

func (app *application) mount() http.Handler {
	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://*", "https://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// A good base middleware stack
	r.Use(middleware.RequestID) // important for rate limiting
	r.Use(middleware.RealIP)    // import for rate limiting and analytics and tracing
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer) // recover from crashes

	// Set a timeout value on the request context (ctx), that will signal
	// through ctx.Done() that the request has timed out and further
	// processing should be stopped.
	r.Use(middleware.Timeout(60 * time.Second))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("all good"))
	})

	service := ledger.NewService(app.queries)
	handler := ledger.NewHandler(service, app.auth)

	r.Post("/users", handler.CreateUser)
	r.Post("/auth/login", handler.Login)

	r.With(app.auth.Middleware(app.queries)).Group(func(r chi.Router) {
		r.Get("/users", handler.ListUsers)
		r.Get("/auth/me", handler.Me)

		r.Get("/categories", handler.ListCategories)
		r.Post("/categories", handler.CreateCategory)

		r.Get("/expenses", handler.ListExpenses)
		r.Post("/expenses", handler.CreateExpense)

		r.Get("/incomes", handler.ListIncomes)
		r.Post("/incomes", handler.CreateIncome)
	})

	return r
}

func (app *application) run(h http.Handler) error {
	srv := &http.Server{
		Addr:         app.config.addr,
		Handler:      h,
		WriteTimeout: time.Second * 30,
		ReadTimeout:  time.Second * 10,
		IdleTimeout:  time.Minute,
	}

	log.Printf("server has started at addr %s", app.config.addr)

	return srv.ListenAndServe()
}

type application struct {
	config  config
	db      *pgx.Conn
	queries *repo.Queries
	auth    *auth.Manager
}

type config struct {
	addr string
	db   dbConfig
	auth authConfig
}

type dbConfig struct {
	dsn string
}

type authConfig struct {
	tokenSecret string
}
