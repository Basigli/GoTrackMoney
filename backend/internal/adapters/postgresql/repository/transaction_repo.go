package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/core"
)

type transactionRepo struct {
	q repo.Querier
}

func NewTransactionRepository(q repo.Querier) core.TransactionRepository {
	return &transactionRepo{q: q}
}

func (r *transactionRepo) CreateExpense(ctx context.Context, exp core.Expense) (core.Expense, error) {
	row, err := r.q.CreateExpense(ctx, repo.CreateExpenseParams{
		Name:        exp.Name,
		Description: exp.Description,
		Amount:      exp.Amount,
		UserID:      exp.UserID,
		CategoryID:  exp.CategoryID,
		SpentOn:     timestamptzFromTime(exp.SpentOn),
		IsPeriodic:  exp.IsPeriodic,
	})
	if err != nil {
		return core.Expense{}, err
	}
	return toCoreExpense(row), nil
}

func (r *transactionRepo) ListExpensesByUserID(ctx context.Context, userID int64, limit, offset int32) ([]core.Expense, error) {
	rows, err := r.q.ListExpensesByUserID(ctx, repo.ListExpensesByUserIDParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, err
	}
	var res []core.Expense
	for _, row := range rows {
		res = append(res, toCoreExpense(row))
	}
	return res, nil
}

func (r *transactionRepo) UpdateExpense(ctx context.Context, exp core.Expense) (core.Expense, error) {
	row, err := r.q.UpdateExpense(ctx, repo.UpdateExpenseParams{
		ID:          exp.ID,
		Name:        exp.Name,
		Description: exp.Description,
		Amount:      exp.Amount,
		CategoryID:  exp.CategoryID,
		SpentOn:     timestamptzFromTime(exp.SpentOn),
		UserID:      exp.UserID,
	})
	if err != nil {
		return core.Expense{}, err
	}
	return toCoreExpense(row), nil
}

func (r *transactionRepo) DeleteExpense(ctx context.Context, id, userID int64) error {
	return r.q.DeleteExpense(ctx, repo.DeleteExpenseParams{
		ID:     id,
		UserID: userID,
	})
}

func (r *transactionRepo) FilterExpensesByDate(ctx context.Context, userID int64, start, end time.Time) ([]core.Expense, error) {
	rows, err := r.q.FilterExpensesByDate(ctx, repo.FilterExpensesByDateParams{
		UserID:    userID,
		SpentOn:   timestamptzFromTime(start),
		SpentOn_2: timestamptzFromTime(end),
	})
	if err != nil {
		return nil, err
	}
	var res []core.Expense
	for _, row := range rows {
		res = append(res, toCoreExpense(row))
	}
	return res, nil
}

func (r *transactionRepo) CreateIncome(ctx context.Context, inc core.Income) (core.Income, error) {
	row, err := r.q.CreateIncome(ctx, repo.CreateIncomeParams{
		Name:        inc.Name,
		Description: inc.Description,
		Amount:      inc.Amount,
		UserID:      inc.UserID,
		CategoryID:  inc.CategoryID,
		ReceivedOn:  timestamptzFromTime(inc.ReceivedOn),
	})
	if err != nil {
		return core.Income{}, err
	}
	return toCoreIncome(row), nil
}

func (r *transactionRepo) ListIncomesByUserID(ctx context.Context, userID int64, limit, offset int32) ([]core.Income, error) {
	rows, err := r.q.ListIncomesByUserID(ctx, repo.ListIncomesByUserIDParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, err
	}
	var res []core.Income
	for _, row := range rows {
		res = append(res, toCoreIncome(row))
	}
	return res, nil
}

func (r *transactionRepo) UpdateIncome(ctx context.Context, inc core.Income) (core.Income, error) {
	row, err := r.q.UpdateIncome(ctx, repo.UpdateIncomeParams{
		ID:          inc.ID,
		Name:        inc.Name,
		Description: inc.Description,
		Amount:      inc.Amount,
		CategoryID:  inc.CategoryID,
		ReceivedOn:  timestamptzFromTime(inc.ReceivedOn),
		UserID:      inc.UserID,
	})
	if err != nil {
		return core.Income{}, err
	}
	return toCoreIncome(row), nil
}

func (r *transactionRepo) DeleteIncome(ctx context.Context, id, userID int64) error {
	return r.q.DeleteIncome(ctx, repo.DeleteIncomeParams{
		ID:     id,
		UserID: userID,
	})
}

func (r *transactionRepo) FilterIncomesByDate(ctx context.Context, userID int64, start, end time.Time) ([]core.Income, error) {
	rows, err := r.q.FilterIncomesByDate(ctx, repo.FilterIncomesByDateParams{
		UserID:       userID,
		ReceivedOn:   timestamptzFromTime(start),
		ReceivedOn_2: timestamptzFromTime(end),
	})
	if err != nil {
		return nil, err
	}
	var res []core.Income
	for _, row := range rows {
		res = append(res, toCoreIncome(row))
	}
	return res, nil
}

func (r *transactionRepo) CreatePeriodicExpense(ctx context.Context, pe core.PeriodicExpense) (core.PeriodicExpense, error) {
	row, err := r.q.CreatePeriodicExpense(ctx, repo.CreatePeriodicExpenseParams{
		Name:           pe.Name,
		Description:    pe.Description,
		Amount:         pe.Amount,
		UserID:         pe.UserID,
		CategoryID:     pe.CategoryID,
		PeriodInterval: pe.PeriodInterval,
		PeriodUnit:     pe.PeriodUnit,
		StartDate:      timestamptzFromTime(pe.StartDate),
		NextDueDate:    timestamptzFromTime(pe.NextDueDate),
	})
	if err != nil {
		return core.PeriodicExpense{}, err
	}
	return toCorePeriodicExpense(row), nil
}

func (r *transactionRepo) ListPeriodicExpensesByUserID(ctx context.Context, userID int64) ([]core.PeriodicExpense, error) {
	rows, err := r.q.ListPeriodicExpensesByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	var res []core.PeriodicExpense
	for _, row := range rows {
		res = append(res, toCorePeriodicExpense(row))
	}
	return res, nil
}

func (r *transactionRepo) FindDuePeriodicExpensesByUserID(ctx context.Context, userID int64) ([]core.PeriodicExpense, error) {
	rows, err := r.q.FindDuePeriodicExpensesByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	var res []core.PeriodicExpense
	for _, row := range rows {
		res = append(res, toCorePeriodicExpense(row))
	}
	return res, nil
}

func (r *transactionRepo) UpdatePeriodicExpense(ctx context.Context, pe core.PeriodicExpense) (core.PeriodicExpense, error) {
	row, err := r.q.UpdatePeriodicExpense(ctx, repo.UpdatePeriodicExpenseParams{
		ID:             pe.ID,
		UserID:         pe.UserID,
		PeriodInterval: pe.PeriodInterval,
		PeriodUnit:     pe.PeriodUnit,
		NextDueDate:    timestamptzFromTime(pe.NextDueDate),
	})
	if err != nil {
		return core.PeriodicExpense{}, err
	}
	return toCorePeriodicExpense(row), nil
}

func (r *transactionRepo) UpdatePeriodicExpenseNextDueDate(ctx context.Context, id int64, lastGen, nextDue time.Time) error {
	return r.q.UpdatePeriodicExpenseNextDueDate(ctx, repo.UpdatePeriodicExpenseNextDueDateParams{
		ID:                id,
		LastGeneratedDate: timestamptzFromTime(lastGen),
		NextDueDate:       timestamptzFromTime(nextDue),
	})
}

func (r *transactionRepo) DeletePeriodicExpense(ctx context.Context, id, userID int64) error {
	return r.q.DeletePeriodicExpense(ctx, repo.DeletePeriodicExpenseParams{
		ID:     id,
		UserID: userID,
	})
}

func (r *transactionRepo) GetExpensesByCategory(ctx context.Context, userID int64, start, end time.Time) ([]core.ExpenseByCategory, error) {
	rows, err := r.q.GetExpensesByCategory(ctx, repo.GetExpensesByCategoryParams{
		UserID:    userID,
		SpentOn:   timestamptzFromTime(start),
		SpentOn_2: timestamptzFromTime(end),
	})
	if err != nil {
		return nil, err
	}
	var res []core.ExpenseByCategory
	for _, row := range rows {
		res = append(res, core.ExpenseByCategory{
			CategoryID: row.CategoryID,
			Total:      row.TotalAmount, // Ensure TotalAmount matches sqlc row
		})
	}
	return res, nil
}

func (r *transactionRepo) GetMonthlyExpenseTotals(ctx context.Context, userID int64, start, end time.Time) ([]core.MonthlyTotal, error) {
	rows, err := r.q.GetMonthlyExpenseTotals(ctx, repo.GetMonthlyExpenseTotalsParams{
		UserID:    userID,
		SpentOn:   timestamptzFromTime(start),
		SpentOn_2: timestamptzFromTime(end),
	})
	if err != nil {
		return nil, err
	}
	var res []core.MonthlyTotal
	for _, row := range rows {
		res = append(res, core.MonthlyTotal{
			YearMonth: fmt.Sprintf("%04d-%02d", row.Year, row.Month),
			Total:     row.TotalAmount,
		})
	}
	return res, nil
}

func (r *transactionRepo) GetMonthlyIncomeTotals(ctx context.Context, userID int64, start, end time.Time) ([]core.MonthlyTotal, error) {
	rows, err := r.q.GetMonthlyIncomeTotals(ctx, repo.GetMonthlyIncomeTotalsParams{
		UserID:       userID,
		ReceivedOn:   timestamptzFromTime(start),
		ReceivedOn_2: timestamptzFromTime(end),
	})
	if err != nil {
		return nil, err
	}
	var res []core.MonthlyTotal
	for _, row := range rows {
		res = append(res, core.MonthlyTotal{
			YearMonth: fmt.Sprintf("%04d-%02d", row.Year, row.Month),
			Total:     row.TotalAmount,
		})
	}
	return res, nil
}

func timestamptzFromTime(t time.Time) pgtype.Timestamptz {
	if t.IsZero() {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func toCoreExpense(row repo.Expense) core.Expense {
	return core.Expense{
		ID:          row.ID,
		Name:        row.Name,
		Description: row.Description,
		Amount:      row.Amount,
		UserID:      row.UserID,
		CreatedAt:   row.CreatedAt.Time,
		CategoryID:  row.CategoryID,
		SpentOn:     row.SpentOn.Time,
		IsPeriodic:  row.IsPeriodic,
	}
}

func toCoreIncome(row repo.Income) core.Income {
	return core.Income{
		ID:          row.ID,
		Name:        row.Name,
		Description: row.Description,
		Amount:      row.Amount,
		UserID:      row.UserID,
		CreatedAt:   row.CreatedAt.Time,
		CategoryID:  row.CategoryID,
		ReceivedOn:  row.ReceivedOn.Time,
	}
}

func toCorePeriodicExpense(row repo.PeriodicExpense) core.PeriodicExpense {
	return core.PeriodicExpense{
		ID:                row.ID,
		Name:              row.Name,
		Description:       row.Description,
		Amount:            row.Amount,
		UserID:            row.UserID,
		CategoryID:        row.CategoryID,
		PeriodInterval:    row.PeriodInterval,
		PeriodUnit:        row.PeriodUnit,
		StartDate:         row.StartDate.Time,
		LastGeneratedDate: row.LastGeneratedDate.Time,
		NextDueDate:       row.NextDueDate.Time,
		CreatedAt:         row.CreatedAt.Time,
	}
}
