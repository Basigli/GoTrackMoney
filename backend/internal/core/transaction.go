package core

import (
	"context"
	"time"
)

type Expense struct {
	ID          int64
	Name        string
	Description string
	Amount      float64
	UserID      int64
	CreatedAt   time.Time
	CategoryID  int64
	SpentOn     time.Time
	IsPeriodic  bool
}

type Income struct {
	ID          int64
	Name        string
	Description string
	Amount      float64
	UserID      int64
	CreatedAt   time.Time
	CategoryID  int64
	ReceivedOn  time.Time
}

type PeriodicExpense struct {
	ID                int64
	Name              string
	Description       string
	Amount            float64
	UserID            int64
	CategoryID        int64
	PeriodInterval    int32
	PeriodUnit        string
	StartDate         time.Time
	LastGeneratedDate time.Time
	NextDueDate       time.Time
	CreatedAt         time.Time
}

type ExpenseByCategory struct {
	CategoryID int64
	Total      float64
}

type MonthlyTotal struct {
	YearMonth string // e.g. "2023-10"
	Total     float64
}

type TransactionRepository interface {
	// Expenses
	CreateExpense(ctx context.Context, exp Expense) (Expense, error)
	ListExpensesByUserID(ctx context.Context, userID int64, limit, offset int32) ([]Expense, error)
	UpdateExpense(ctx context.Context, exp Expense) (Expense, error)
	DeleteExpense(ctx context.Context, id, userID int64) error
	FilterExpensesByDate(ctx context.Context, userID int64, start, end time.Time) ([]Expense, error)

	// Incomes
	CreateIncome(ctx context.Context, inc Income) (Income, error)
	ListIncomesByUserID(ctx context.Context, userID int64, limit, offset int32) ([]Income, error)
	UpdateIncome(ctx context.Context, inc Income) (Income, error)
	DeleteIncome(ctx context.Context, id, userID int64) error
	FilterIncomesByDate(ctx context.Context, userID int64, start, end time.Time) ([]Income, error)

	// Periodic Expenses
	CreatePeriodicExpense(ctx context.Context, pe PeriodicExpense) (PeriodicExpense, error)
	ListPeriodicExpensesByUserID(ctx context.Context, userID int64) ([]PeriodicExpense, error)
	FindDuePeriodicExpensesByUserID(ctx context.Context, userID int64) ([]PeriodicExpense, error)
	UpdatePeriodicExpense(ctx context.Context, pe PeriodicExpense) (PeriodicExpense, error)
	UpdatePeriodicExpenseNextDueDate(ctx context.Context, id int64, lastGen, nextDue time.Time) error
	DeletePeriodicExpense(ctx context.Context, id, userID int64) error

	// Analytics
	GetExpensesByCategory(ctx context.Context, userID int64, start, end time.Time) ([]ExpenseByCategory, error)
	GetMonthlyExpenseTotals(ctx context.Context, userID int64, start, end time.Time) ([]MonthlyTotal, error)
	GetMonthlyIncomeTotals(ctx context.Context, userID int64, start, end time.Time) ([]MonthlyTotal, error)
}
