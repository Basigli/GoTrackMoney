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
	UpdateUser(ctx context.Context, id int64, params updateUserParams) (repo.User, error)
	DeleteUser(ctx context.Context, id int64) error
	AuthenticateUser(ctx context.Context, params loginParams) (repo.User, error)

	ListCategories(ctx context.Context) ([]repo.Category, error)
	CreateCategory(ctx context.Context, params createCategoryParams) (repo.Category, error)
	UpdateCategory(ctx context.Context, params updateCategoryParams) (repo.Category, error)

	ListExpenses(ctx context.Context, limit, offset int32) ([]repo.Expense, error)
	CreateExpense(ctx context.Context, params createExpenseParams) (repo.Expense, error)
	UpdateExpense(ctx context.Context, params updateExpenseParams) (repo.Expense, error)

	ListIncomes(ctx context.Context, limit, offset int32) ([]repo.Income, error)
	CreateIncome(ctx context.Context, params createIncomeParams) (repo.Income, error)
	UpdateIncome(ctx context.Context, params updateIncomeParams) (repo.Income, error)

	ListPeriodicExpenses(ctx context.Context) ([]repo.PeriodicExpense, error)
	CreatePeriodicExpense(ctx context.Context, params createPeriodicExpenseParams) (repo.PeriodicExpense, error)
	DeletePeriodicExpense(ctx context.Context, id int64) error
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

type updateUserParams struct {
	Username             string `json:"username"`
	Password             string `json:"password"`
	SessionDurationHours int32  `json:"session_duration_hours"`
}

func (s *svc) UpdateUser(ctx context.Context, id int64, params updateUserParams) (repo.User, error) {
	var hashStr string
	if params.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(params.Password), bcrypt.DefaultCost)
		if err != nil {
			return repo.User{}, err
		}
		hashStr = string(hash)
	}

	if params.Username != "" {
		existing, err := s.repo.FindUserByUsername(ctx, params.Username)
		if err == nil && existing.ID != id {
			return repo.User{}, ErrUsernameTaken
		}
	}

	return s.repo.UpdateUser(ctx, repo.UpdateUserParams{
		ID:      id,
		Column2: params.Username,
		Column3: hashStr,
		Column4: params.SessionDurationHours,
	})
}

func (s *svc) DeleteUser(ctx context.Context, id int64) error {
	return s.repo.DeleteUser(ctx, id)
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
	if params.Emoji == "" {
		params.Emoji = "📝"
	}
	if params.Type == "" {
		params.Type = "expense"
	}

	user, err := currentUser(ctx)
	if err != nil {
		return repo.Category{}, err
	}
	return s.repo.CreateCategory(ctx, repo.CreateCategoryParams{
		Name:      params.Name,
		CreatorID: user.ID,
		Emoji:     params.Emoji,
		Type:      params.Type,
	})
}

func (s *svc) UpdateCategory(ctx context.Context, params updateCategoryParams) (repo.Category, error) {
	if params.ID <= 0 {
		return repo.Category{}, fmt.Errorf("id is required")
	}
	if params.Name == "" {
		return repo.Category{}, fmt.Errorf("name is required")
	}

	user, err := currentUser(ctx)
	if err != nil {
		return repo.Category{}, err
	}

	return s.repo.UpdateCategory(ctx, repo.UpdateCategoryParams{
		ID:        params.ID,
		Name:      params.Name,
		Emoji:     params.Emoji,
		Type:      params.Type,
		CreatorID: user.ID,
	})
}

func (s *svc) ListExpenses(ctx context.Context, limit, offset int32) ([]repo.Expense, error) {
	user, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	s.checkAndGeneratePeriodicExpenses(ctx, user.ID)
	return s.repo.ListExpensesByUserID(ctx, repo.ListExpensesByUserIDParams{
		UserID: user.ID,
		Limit:  limit,
		Offset: offset,
	})
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

func (s *svc) UpdateExpense(ctx context.Context, params updateExpenseParams) (repo.Expense, error) {
	if params.ID <= 0 {
		return repo.Expense{}, fmt.Errorf("id is required")
	}
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

	return s.repo.UpdateExpense(ctx, repo.UpdateExpenseParams{
		ID:          params.ID,
		Name:        params.Name,
		Description: params.Description,
		Amount:      params.Amount,
		CategoryID:  params.CategoryID,
		SpentOn:     timestamptzFromTime(params.SpentOn),
		UserID:      user.ID,
	})
}

func (s *svc) ListIncomes(ctx context.Context, limit, offset int32) ([]repo.Income, error) {
	user, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListIncomesByUserID(ctx, repo.ListIncomesByUserIDParams{
		UserID: user.ID,
		Limit:  limit,
		Offset: offset,
	})
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

func (s *svc) UpdateIncome(ctx context.Context, params updateIncomeParams) (repo.Income, error) {
	if params.ID <= 0 {
		return repo.Income{}, fmt.Errorf("id is required")
	}
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

	return s.repo.UpdateIncome(ctx, repo.UpdateIncomeParams{
		ID:          params.ID,
		Name:        params.Name,
		Description: params.Description,
		Amount:      params.Amount,
		CategoryID:  params.CategoryID,
		ReceivedOn:  timestamptzFromTime(params.ReceivedOn),
		UserID:      user.ID,
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

func (s *svc) checkAndGeneratePeriodicExpenses(ctx context.Context, userID int64) error {
	dueExpenses, err := s.repo.FindDuePeriodicExpensesByUserID(ctx, userID)
	if err != nil {
		return err
	}
	
	now := time.Now()
	for _, pe := range dueExpenses {
		// generate the expense
		_, err := s.repo.CreateExpense(ctx, repo.CreateExpenseParams{
			Name:        pe.Name,
			Description: pe.Description,
			Amount:      pe.Amount,
			UserID:      pe.UserID,
			CategoryID:  pe.CategoryID,
			SpentOn:     pgtype.Timestamptz{Time: pe.NextDueDate.Time, Valid: true},
		})
		if err != nil {
			return err
		}
		
		// calculate next due date
		nextDue := pe.NextDueDate.Time
		switch pe.PeriodUnit {
		case "days":
			nextDue = nextDue.AddDate(0, 0, int(pe.PeriodInterval))
		case "weeks":
			nextDue = nextDue.AddDate(0, 0, int(pe.PeriodInterval)*7)
		case "months":
			nextDue = nextDue.AddDate(0, int(pe.PeriodInterval), 0)
		case "years":
			nextDue = nextDue.AddDate(int(pe.PeriodInterval), 0, 0)
		}
		
		err = s.repo.UpdatePeriodicExpenseNextDueDate(ctx, repo.UpdatePeriodicExpenseNextDueDateParams{
			ID:                pe.ID,
			LastGeneratedDate: pgtype.Timestamptz{Time: now, Valid: true},
			NextDueDate:       pgtype.Timestamptz{Time: nextDue, Valid: true},
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *svc) ListPeriodicExpenses(ctx context.Context) ([]repo.PeriodicExpense, error) {
	user, err := currentUser(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListPeriodicExpensesByUserID(ctx, user.ID)
}

func (s *svc) CreatePeriodicExpense(ctx context.Context, params createPeriodicExpenseParams) (repo.PeriodicExpense, error) {
	if params.Name == "" {
		return repo.PeriodicExpense{}, fmt.Errorf("name is required")
	}
	if params.Amount <= 0 {
		return repo.PeriodicExpense{}, fmt.Errorf("amount must be greater than zero")
	}
	if params.CategoryID <= 0 {
		return repo.PeriodicExpense{}, fmt.Errorf("category_id is required")
	}
	if params.PeriodInterval <= 0 {
		params.PeriodInterval = 1
	}
	if params.PeriodUnit == "" {
		params.PeriodUnit = "months"
	}

	user, err := currentUser(ctx)
	if err != nil {
		return repo.PeriodicExpense{}, err
	}
	
	if _, err := s.repo.FindCategoryByIDAndCreatorID(ctx, repo.FindCategoryByIDAndCreatorIDParams{
		ID:        params.CategoryID,
		CreatorID: user.ID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repo.PeriodicExpense{}, ErrCategoryNotFound
		}
		return repo.PeriodicExpense{}, err
	}

	startDate := time.Now()
	if params.StartDate != nil {
		startDate = *params.StartDate
	}
	nextDueDate := startDate

	return s.repo.CreatePeriodicExpense(ctx, repo.CreatePeriodicExpenseParams{
		Name:           params.Name,
		Description:    params.Description,
		Amount:         params.Amount,
		UserID:         user.ID,
		CategoryID:     params.CategoryID,
		PeriodInterval: params.PeriodInterval,
		PeriodUnit:     params.PeriodUnit,
		StartDate:      pgtype.Timestamptz{Time: startDate, Valid: true},
		NextDueDate:    pgtype.Timestamptz{Time: nextDueDate, Valid: true},
	})
}

func (s *svc) DeletePeriodicExpense(ctx context.Context, id int64) error {
	user, err := currentUser(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeletePeriodicExpense(ctx, repo.DeletePeriodicExpenseParams{
		ID:     id,
		UserID: user.ID,
	})
}
