package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/core"
)

type categoryRepo struct {
	q repo.Querier
}

func NewCategoryRepository(q repo.Querier) core.CategoryRepository {
	return &categoryRepo{q: q}
}

func (r *categoryRepo) CreateCategory(ctx context.Context, cat core.Category) (core.Category, error) {
	row, err := r.q.CreateCategory(ctx, repo.CreateCategoryParams{
		Name:      cat.Name,
		CreatorID: cat.CreatorID,
		Emoji:     cat.Emoji,
		Type:      cat.Type,
		Color:     cat.Color,
	})
	if err != nil {
		return core.Category{}, err
	}
	return toCoreCategory(row), nil
}

func (r *categoryRepo) FindCategoryByIDAndCreatorID(ctx context.Context, id, creatorID int64) (core.Category, error) {
	row, err := r.q.FindCategoryByIDAndCreatorID(ctx, repo.FindCategoryByIDAndCreatorIDParams{
		ID:        id,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return core.Category{}, errors.New("category not found")
		}
		return core.Category{}, err
	}
	return toCoreCategory(row), nil
}

func (r *categoryRepo) ListCategoriesByCreatorID(ctx context.Context, creatorID int64) ([]core.Category, error) {
	rows, err := r.q.ListCategoriesByCreatorID(ctx, creatorID)
	if err != nil {
		return nil, err
	}
	var cats []core.Category
	for _, row := range rows {
		cats = append(cats, toCoreCategory(row))
	}
	return cats, nil
}

func (r *categoryRepo) UpdateCategory(ctx context.Context, cat core.Category) (core.Category, error) {
	row, err := r.q.UpdateCategory(ctx, repo.UpdateCategoryParams{
		ID:        cat.ID,
		Name:      cat.Name,
		Emoji:     cat.Emoji,
		Type:      cat.Type,
		Color:     cat.Color,
		CreatorID: cat.CreatorID,
	})
	if err != nil {
		return core.Category{}, err
	}
	return toCoreCategory(row), nil
}

func toCoreCategory(row repo.Category) core.Category {
	return core.Category{
		ID:        row.ID,
		Name:      row.Name,
		CreatorID: row.CreatorID,
		Emoji:     row.Emoji,
		Type:      row.Type,
		Color:     row.Color,
	}
}
