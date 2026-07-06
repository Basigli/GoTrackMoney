package service

import (
	"context"
	"time"

	"github.com/sikozonpc/ecom/internal/core"
)

type AnalyticsService interface {
	GetExpensesByCategory(ctx context.Context, userID int64, year, month int) ([]core.ExpenseByCategory, error)
	GetIncomeVsExpense(ctx context.Context, userID int64, year, month int) ([]core.MonthlyTotal, []core.MonthlyTotal, error)
}

type analyticsService struct {
	txRepo core.TransactionRepository
}

func NewAnalyticsService(txRepo core.TransactionRepository) AnalyticsService {
	return &analyticsService{txRepo: txRepo}
}

func (s *analyticsService) GetExpensesByCategory(ctx context.Context, userID int64, year, month int) ([]core.ExpenseByCategory, error) {
	var start, end time.Time
	if month > 0 && month <= 12 {
		start = time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 1, 0)
	} else {
		start = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(1, 0, 0)
	}
	return s.txRepo.GetExpensesByCategory(ctx, userID, start, end)
}

func (s *analyticsService) GetIncomeVsExpense(ctx context.Context, userID int64, year, month int) ([]core.MonthlyTotal, []core.MonthlyTotal, error) {
	selectedMonthDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	start := selectedMonthDate.AddDate(0, -5, 0)
	end := selectedMonthDate.AddDate(0, 1, 0)

	incomes, err := s.txRepo.GetMonthlyIncomeTotals(ctx, userID, start, end)
	if err != nil {
		return nil, nil, err
	}
	expenses, err := s.txRepo.GetMonthlyExpenseTotals(ctx, userID, start, end)
	if err != nil {
		return nil, nil, err
	}

	return incomes, expenses, nil
}
