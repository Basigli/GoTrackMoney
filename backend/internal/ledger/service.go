package ledger

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/auth"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrCategoryNotFound   = errors.New("category not found")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUsernameTaken      = errors.New("username already exists")
)

type Service interface {
	ListUsers(ctx context.Context) ([]repo.User, error)
	CreateUser(ctx context.Context, params createUserParams) (repo.User, error)
	AuthenticateUser(ctx context.Context, params loginParams) (repo.User, error)

	ListCategories(ctx context.Context) ([]repo.Category, error)
	CreateCategory(ctx context.Context, params createCategoryParams) (repo.Category, error)

	ListExpenses(ctx context.Context) ([]repo.Expense, error)
	CreateExpense(ctx context.Context, params createExpenseParams) (repo.Expense, error)

	ListIncomes(ctx context.Context) ([]repo.Income, error)
	CreateIncome(ctx context.Context, params createIncomeParams) (repo.Income, error)
}

type svc struct {
	repo repo.Querier
}

func NewService(repo repo.Querier) Service {
	return &svc{repo: repo}
}

func (s *svc) ListUsers(ctx context.Context) ([]repo.User, error) {
	return s.repo.ListUsers(ctx)
}

func (s *svc) CreateUser(ctx context.Context, params createUserParams) (repo.User, error) {
	if params.Username == "" {
		return repo.User{}, fmt.Errorf("username is required")
	}
	if params.Password == "" {
		return repo.User{}, fmt.Errorf("password is required")
	}
	if _, err := s.repo.FindUserByUsername(ctx, params.Username); err == nil {
		return repo.User{}, ErrUsernameTaken
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return repo.User{}, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(params.Password), bcrypt.DefaultCost)
	if err != nil {
		return repo.User{}, err
	}

	return s.repo.CreateUser(ctx, repo.CreateUserParams{
		Username: params.Username,
		Password: string(hash),
	})
}

func (s *svc) AuthenticateUser(ctx context.Context, params loginParams) (repo.User, error) {
	if params.Username == "" || params.Password == "" {
		return repo.User{}, ErrInvalidCredentials
	}

	user, err := s.repo.FindUserByUsername(ctx, params.Username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repo.User{}, ErrInvalidCredentials
		}
		return repo.User{}, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(params.Password)); err != nil {
		return repo.User{}, ErrInvalidCredentials
	}

	return user, nil
}

func (s *svc) ListCategories(ctx context.Context) ([]repo.Category, error) {
	user, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListCategoriesByCreatorID(ctx, user.ID)
}

func (s *svc) CreateCategory(ctx context.Context, params createCategoryParams) (repo.Category, error) {
	if params.Name == "" {
		return repo.Category{}, fmt.Errorf("name is required")
	}

	user, err := currentUser(ctx)
	if err != nil {
		return repo.Category{}, err
	}
	return s.repo.CreateCategory(ctx, repo.CreateCategoryParams{
		Name:      params.Name,
		CreatorID: user.ID,
	})
}

func (s *svc) ListExpenses(ctx context.Context) ([]repo.Expense, error) {
	user, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListExpensesByUserID(ctx, user.ID)
}

func (s *svc) CreateExpense(ctx context.Context, params createExpenseParams) (repo.Expense, error) {
	if params.Name == "" {
		return repo.Expense{}, fmt.Errorf("name is required")
	}
	if params.Amount <= 0 {
		return repo.Expense{}, fmt.Errorf("amount must be greater than zero")
	}
	if params.CategoryID <= 0 {
		return repo.Expense{}, fmt.Errorf("category_id is required")
	}

	user, err := currentUser(ctx)
	if err != nil {
		return repo.Expense{}, err
	}
	if _, err := s.repo.FindCategoryByIDAndCreatorID(ctx, repo.FindCategoryByIDAndCreatorIDParams{
		ID:        params.CategoryID,
		CreatorID: user.ID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repo.Expense{}, ErrCategoryNotFound
		}
		return repo.Expense{}, err
	}
	return s.repo.CreateExpense(ctx, repo.CreateExpenseParams{
		Name:        params.Name,
		Description: params.Description,
		Amount:      params.Amount,
		UserID:      user.ID,
		CategoryID:  params.CategoryID,
		SpentOn:     timestamptzFromTime(params.SpentOn),
	})
}

func (s *svc) ListIncomes(ctx context.Context) ([]repo.Income, error) {
	user, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListIncomesByUserID(ctx, user.ID)
}

func (s *svc) CreateIncome(ctx context.Context, params createIncomeParams) (repo.Income, error) {
	if params.Name == "" {
		return repo.Income{}, fmt.Errorf("name is required")
	}
	if params.Amount <= 0 {
		return repo.Income{}, fmt.Errorf("amount must be greater than zero")
	}
	if params.CategoryID <= 0 {
		return repo.Income{}, fmt.Errorf("category_id is required")
	}

	user, err := currentUser(ctx)
	if err != nil {
		return repo.Income{}, err
	}
	if _, err := s.repo.FindCategoryByIDAndCreatorID(ctx, repo.FindCategoryByIDAndCreatorIDParams{
		ID:        params.CategoryID,
		CreatorID: user.ID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repo.Income{}, ErrCategoryNotFound
		}
		return repo.Income{}, err
	}
	return s.repo.CreateIncome(ctx, repo.CreateIncomeParams{
		Name:        params.Name,
		Description: params.Description,
		Amount:      params.Amount,
		UserID:      user.ID,
		CategoryID:  params.CategoryID,
		ReceivedOn:  timestamptzFromTime(params.ReceivedOn),
	})
}

func timestamptzFromTime(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func currentUser(ctx context.Context) (auth.User, error) {
	user, ok := auth.CurrentUser(ctx)
	if !ok {
		return auth.User{}, auth.ErrUnauthorized
	}

	return user, nil
}
