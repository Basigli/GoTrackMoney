package core

import "context"

type Category struct {
	ID        int64
	Name      string
	CreatorID int64
	Emoji     string
	Type      string
	Color     string
}

type CategoryRepository interface {
	CreateCategory(ctx context.Context, cat Category) (Category, error)
	FindCategoryByIDAndCreatorID(ctx context.Context, id, creatorID int64) (Category, error)
	ListCategoriesByCreatorID(ctx context.Context, creatorID int64) ([]Category, error)
	UpdateCategory(ctx context.Context, cat Category) (Category, error)
}
