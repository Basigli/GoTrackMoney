package repo

import (
	"context"
)

type Querier interface {
	CreateCategory(ctx context.Context, arg CreateCategoryParams) (Category, error)
	CreateExpense(ctx context.Context, arg CreateExpenseParams) (Expense, error)
	CreateIncome(ctx context.Context, arg CreateIncomeParams) (Income, error)
	CreateUser(ctx context.Context, arg CreateUserParams) (User, error)
	FindCategoryByIDAndCreatorID(ctx context.Context, arg FindCategoryByIDAndCreatorIDParams) (Category, error)
	FindCategoryByID(ctx context.Context, id int64) (Category, error)
	FindUserByUsername(ctx context.Context, username string) (User, error)
	FindUserByID(ctx context.Context, id int64) (User, error)
	ListCategories(ctx context.Context) ([]Category, error)
	ListCategoriesByCreatorID(ctx context.Context, creatorID int64) ([]Category, error)
	ListExpenses(ctx context.Context) ([]Expense, error)
	ListExpensesByUserID(ctx context.Context, userID int64) ([]Expense, error)
	ListIncomes(ctx context.Context) ([]Income, error)
	ListIncomesByUserID(ctx context.Context, userID int64) ([]Income, error)
	ListUsers(ctx context.Context) ([]User, error)
}
