package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sikozonpc/ecom/internal/adapters/postgresql/repository"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/auth"
	"github.com/sikozonpc/ecom/internal/env"
	"github.com/sikozonpc/ecom/internal/service"
	myhttp "github.com/sikozonpc/ecom/internal/transport/http"
)

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

func main() {
	ctx := context.Background()

	cfg := config{
		addr: env.GetString("PORT", ":8098"),
		db: dbConfig{
			dsn: env.GetString("GOOSE_DBSTRING", "host=localhost user=postgres password=postgres dbname=ecom sslmode=disable"),
		},
		auth: authConfig{
			tokenSecret: env.GetString("AUTH_TOKEN_SECRET", "dev-auth-secret-change-me"),
		},
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	pool, err := pgxpool.New(ctx, cfg.db.dsn)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	logger.Info("connected to database", "dsn", cfg.db.dsn)

	// Adapters Layer
	queries := repo.New(pool)
	userRepo := repository.NewUserRepository(queries)
	catRepo := repository.NewCategoryRepository(queries)
	txRepo := repository.NewTransactionRepository(queries)

	// Service Layer
	userSvc := service.NewUserService(userRepo)
	catSvc := service.NewCategoryService(catRepo)
	txSvc := service.NewTransactionService(txRepo, catRepo)
	analyticsSvc := service.NewAnalyticsService(txRepo)

	authManager := auth.NewManager(cfg.auth.tokenSecret, 24*time.Hour)

	// HTTP Transport Layer
	handler := myhttp.NewHandler(userSvc, catSvc, txSvc, analyticsSvc, authManager)

	r := mount(handler, authManager, queries)

	srv := &http.Server{
		Addr:         cfg.addr,
		Handler:      r,
		WriteTimeout: time.Second * 30,
		ReadTimeout:  time.Second * 10,
		IdleTimeout:  time.Minute,
	}

	log.Printf("server has started at addr %s", cfg.addr)
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("server failed to start", "error", err)
		os.Exit(1)
	}
}
