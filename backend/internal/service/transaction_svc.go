package service

import (
	"context"
	"errors"
	"time"

	"github.com/sikozonpc/ecom/internal/core"
)

type TransactionService interface {
	ListExpenses(ctx context.Context, userID int64, limit, offset int32) ([]core.Expense, error)
	CreateExpense(ctx context.Context, userID int64, name, desc string, amount float64, catID int64, spentOn time.Time) (core.Expense, error)
	UpdateExpense(ctx context.Context, userID int64, id int64, name, desc string, amount float64, catID int64, spentOn time.Time) (core.Expense, error)
	DeleteExpense(ctx context.Context, userID int64, id int64) error
	FilterExpenses(ctx context.Context, userID int64, start, end time.Time) ([]core.Expense, error)

	ListIncomes(ctx context.Context, userID int64, limit, offset int32) ([]core.Income, error)
	CreateIncome(ctx context.Context, userID int64, name, desc string, amount float64, catID int64, receivedOn time.Time) (core.Income, error)
	UpdateIncome(ctx context.Context, userID int64, id int64, name, desc string, amount float64, catID int64, receivedOn time.Time) (core.Income, error)
	DeleteIncome(ctx context.Context, userID int64, id int64) error
	FilterIncomes(ctx context.Context, userID int64, start, end time.Time) ([]core.Income, error)

	ListPeriodicExpenses(ctx context.Context, userID int64) ([]core.PeriodicExpense, error)
	CreatePeriodicExpense(ctx context.Context, userID int64, name, desc string, amount float64, catID int64, interval int32, unit string, start *time.Time) (core.PeriodicExpense, error)
	UpdatePeriodicExpense(ctx context.Context, userID int64, id int64, interval int32, unit string, nextDue *time.Time) (core.PeriodicExpense, error)
	DeletePeriodicExpense(ctx context.Context, userID int64, id int64) error

	CheckAndGeneratePeriodicExpenses(ctx context.Context, userID int64) error
}

type transactionService struct {
	txRepo  core.TransactionRepository
	catRepo core.CategoryRepository
}

func NewTransactionService(txRepo core.TransactionRepository, catRepo core.CategoryRepository) TransactionService {
	return &transactionService{
		txRepo:  txRepo,
		catRepo: catRepo,
	}
}

func (s *transactionService) checkCategory(ctx context.Context, userID, catID int64) error {
	_, err := s.catRepo.FindCategoryByIDAndCreatorID(ctx, catID, userID)
	if err != nil {
		return ErrCategoryNotFound
	}
	return nil
}

// Expenses
func (s *transactionService) ListExpenses(ctx context.Context, userID int64, limit, offset int32) ([]core.Expense, error) {
	if err := s.CheckAndGeneratePeriodicExpenses(ctx, userID); err != nil {
		return nil, err
	}
	return s.txRepo.ListExpensesByUserID(ctx, userID, limit, offset)
}

func (s *transactionService) CreateExpense(ctx context.Context, userID int64, name, desc string, amount float64, catID int64, spentOn time.Time) (core.Expense, error) {
	if name == "" {
		return core.Expense{}, errors.New("name is required")
	}
	if amount <= 0 {
		return core.Expense{}, errors.New("amount must be greater than zero")
	}
	if err := s.checkCategory(ctx, userID, catID); err != nil {
		return core.Expense{}, err
	}
	return s.txRepo.CreateExpense(ctx, core.Expense{
		Name:        name,
		Description: desc,
		Amount:      amount,
		UserID:      userID,
		CategoryID:  catID,
		SpentOn:     spentOn,
	})
}

func (s *transactionService) UpdateExpense(ctx context.Context, userID int64, id int64, name, desc string, amount float64, catID int64, spentOn time.Time) (core.Expense, error) {
	if name == "" {
		return core.Expense{}, errors.New("name is required")
	}
	if amount <= 0 {
		return core.Expense{}, errors.New("amount must be greater than zero")
	}
	if err := s.checkCategory(ctx, userID, catID); err != nil {
		return core.Expense{}, err
	}
	return s.txRepo.UpdateExpense(ctx, core.Expense{
		ID:          id,
		Name:        name,
		Description: desc,
		Amount:      amount,
		UserID:      userID,
		CategoryID:  catID,
		SpentOn:     spentOn,
	})
}

func (s *transactionService) DeleteExpense(ctx context.Context, userID int64, id int64) error {
	return s.txRepo.DeleteExpense(ctx, id, userID)
}

func (s *transactionService) FilterExpenses(ctx context.Context, userID int64, start, end time.Time) ([]core.Expense, error) {
	if err := s.CheckAndGeneratePeriodicExpenses(ctx, userID); err != nil {
		return nil, err
	}
	return s.txRepo.FilterExpensesByDate(ctx, userID, start, end)
}

// Incomes
func (s *transactionService) ListIncomes(ctx context.Context, userID int64, limit, offset int32) ([]core.Income, error) {
	return s.txRepo.ListIncomesByUserID(ctx, userID, limit, offset)
}

func (s *transactionService) CreateIncome(ctx context.Context, userID int64, name, desc string, amount float64, catID int64, receivedOn time.Time) (core.Income, error) {
	if name == "" {
		return core.Income{}, errors.New("name is required")
	}
	if amount <= 0 {
		return core.Income{}, errors.New("amount must be greater than zero")
	}
	if err := s.checkCategory(ctx, userID, catID); err != nil {
		return core.Income{}, err
	}
	return s.txRepo.CreateIncome(ctx, core.Income{
		Name:        name,
		Description: desc,
		Amount:      amount,
		UserID:      userID,
		CategoryID:  catID,
		ReceivedOn:  receivedOn,
	})
}

func (s *transactionService) UpdateIncome(ctx context.Context, userID int64, id int64, name, desc string, amount float64, catID int64, receivedOn time.Time) (core.Income, error) {
	if name == "" {
		return core.Income{}, errors.New("name is required")
	}
	if amount <= 0 {
		return core.Income{}, errors.New("amount must be greater than zero")
	}
	if err := s.checkCategory(ctx, userID, catID); err != nil {
		return core.Income{}, err
	}
	return s.txRepo.UpdateIncome(ctx, core.Income{
		ID:          id,
		Name:        name,
		Description: desc,
		Amount:      amount,
		UserID:      userID,
		CategoryID:  catID,
		ReceivedOn:  receivedOn,
	})
}

func (s *transactionService) DeleteIncome(ctx context.Context, userID int64, id int64) error {
	return s.txRepo.DeleteIncome(ctx, id, userID)
}

func (s *transactionService) FilterIncomes(ctx context.Context, userID int64, start, end time.Time) ([]core.Income, error) {
	return s.txRepo.FilterIncomesByDate(ctx, userID, start, end)
}

// Periodic Expenses
func (s *transactionService) ListPeriodicExpenses(ctx context.Context, userID int64) ([]core.PeriodicExpense, error) {
	return s.txRepo.ListPeriodicExpensesByUserID(ctx, userID)
}

func (s *transactionService) CreatePeriodicExpense(ctx context.Context, userID int64, name, desc string, amount float64, catID int64, interval int32, unit string, start *time.Time) (core.PeriodicExpense, error) {
	if name == "" {
		return core.PeriodicExpense{}, errors.New("name is required")
	}
	if amount <= 0 {
		return core.PeriodicExpense{}, errors.New("amount must be greater than zero")
	}
	if err := s.checkCategory(ctx, userID, catID); err != nil {
		return core.PeriodicExpense{}, err
	}

	if interval <= 0 {
		interval = 1
	}
	if unit == "" {
		unit = "months"
	}

	startDate := time.Now()
	if start != nil {
		startDate = *start
	}

	pe := core.PeriodicExpense{
		Name:           name,
		Description:    desc,
		Amount:         amount,
		UserID:         userID,
		CategoryID:     catID,
		PeriodInterval: interval,
		PeriodUnit:     unit,
		StartDate:      startDate,
		NextDueDate:    startDate,
	}
	return s.txRepo.CreatePeriodicExpense(ctx, pe)
}

func (s *transactionService) UpdatePeriodicExpense(ctx context.Context, userID int64, id int64, interval int32, unit string, nextDue *time.Time) (core.PeriodicExpense, error) {
	if interval <= 0 {
		return core.PeriodicExpense{}, errors.New("interval must be > 0")
	}
	if unit == "" {
		return core.PeriodicExpense{}, errors.New("unit is required")
	}

	nd := time.Now()
	if nextDue != nil {
		nd = *nextDue
	}

	pe := core.PeriodicExpense{
		ID:             id,
		UserID:         userID,
		PeriodInterval: interval,
		PeriodUnit:     unit,
		NextDueDate:    nd,
	}
	return s.txRepo.UpdatePeriodicExpense(ctx, pe)
}

func (s *transactionService) DeletePeriodicExpense(ctx context.Context, userID int64, id int64) error {
	return s.txRepo.DeletePeriodicExpense(ctx, id, userID)
}

func (s *transactionService) CheckAndGeneratePeriodicExpenses(ctx context.Context, userID int64) error {
	due, err := s.txRepo.FindDuePeriodicExpensesByUserID(ctx, userID)
	if err != nil {
		return err
	}

	now := time.Now()
	for _, pe := range due {
		_, err := s.txRepo.CreateExpense(ctx, core.Expense{
			Name:        pe.Name,
			Description: pe.Description,
			Amount:      pe.Amount,
			UserID:      pe.UserID,
			CategoryID:  pe.CategoryID,
			SpentOn:     pe.NextDueDate,
			IsPeriodic:  true,
		})
		if err != nil {
			return err
		}

		nextDue := pe.NextDueDate
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

		err = s.txRepo.UpdatePeriodicExpenseNextDueDate(ctx, pe.ID, now, nextDue)
		if err != nil {
			return err
		}
	}
	return nil
}
