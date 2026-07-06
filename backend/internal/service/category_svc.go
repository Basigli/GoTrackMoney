package service

import (
	"context"
	"errors"

	"github.com/sikozonpc/ecom/internal/core"
)

var ErrCategoryNotFound = errors.New("category not found")

type CategoryService interface {
	ListCategories(ctx context.Context, userID int64) ([]core.Category, error)
	CreateCategory(ctx context.Context, userID int64, name, emoji, catType, color string) (core.Category, error)
	UpdateCategory(ctx context.Context, userID int64, id int64, name, emoji, catType, color string) (core.Category, error)
}

type categoryService struct {
	repo core.CategoryRepository
}

func NewCategoryService(repo core.CategoryRepository) CategoryService {
	return &categoryService{repo: repo}
}

func (s *categoryService) ListCategories(ctx context.Context, userID int64) ([]core.Category, error) {
	return s.repo.ListCategoriesByCreatorID(ctx, userID)
}

func (s *categoryService) CreateCategory(ctx context.Context, userID int64, name, emoji, catType, color string) (core.Category, error) {
	if name == "" {
		return core.Category{}, errors.New("name is required")
	}
	if emoji == "" {
		emoji = "📝"
	}
	if catType == "" {
		catType = "expense"
	}

	cat := core.Category{
		Name:      name,
		CreatorID: userID,
		Emoji:     emoji,
		Type:      catType,
		Color:     color,
	}

	return s.repo.CreateCategory(ctx, cat)
}

func (s *categoryService) UpdateCategory(ctx context.Context, userID int64, id int64, name, emoji, catType, color string) (core.Category, error) {
	if id <= 0 {
		return core.Category{}, errors.New("id is required")
	}
	if name == "" {
		return core.Category{}, errors.New("name is required")
	}

	cat := core.Category{
		ID:        id,
		Name:      name,
		CreatorID: userID,
		Emoji:     emoji,
		Type:      catType,
		Color:     color,
	}

	return s.repo.UpdateCategory(ctx, cat)
}
