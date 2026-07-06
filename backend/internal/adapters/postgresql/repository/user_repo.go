package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	repo "github.com/sikozonpc/ecom/internal/adapters/postgresql/sqlc"
	"github.com/sikozonpc/ecom/internal/core"
)

type userRepo struct {
	q repo.Querier
}

func NewUserRepository(q repo.Querier) core.UserRepository {
	return &userRepo{q: q}
}

func (r *userRepo) ListUsers(ctx context.Context) ([]core.User, error) {
	rows, err := r.q.ListUsers(ctx)
	if err != nil {
		return nil, err
	}
	var users []core.User
	for _, row := range rows {
		users = append(users, toCoreUser(row))
	}
	return users, nil
}

func (r *userRepo) FindUserByUsername(ctx context.Context, username string) (core.User, error) {
	row, err := r.q.FindUserByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return core.User{}, errors.New("user not found")
		}
		return core.User{}, err
	}
	return toCoreUser(row), nil
}

func (r *userRepo) CountUsers(ctx context.Context) (int64, error) {
	return r.q.CountUsers(ctx)
}

func (r *userRepo) CreateUser(ctx context.Context, username, hashedPassword string) (core.User, error) {
	row, err := r.q.CreateUser(ctx, repo.CreateUserParams{
		Username: username,
		Password: hashedPassword,
	})
	if err != nil {
		return core.User{}, err
	}
	return toCoreUser(row), nil
}

func (r *userRepo) UpdateUser(ctx context.Context, id int64, username, hashedPassword string, sessionDuration int32) (core.User, error) {
	row, err := r.q.UpdateUser(ctx, repo.UpdateUserParams{
		ID:      id,
		Column2: username,
		Column3: hashedPassword,
		Column4: sessionDuration,
	})
	if err != nil {
		return core.User{}, err
	}
	return toCoreUser(row), nil
}

func (r *userRepo) UpdateUserRole(ctx context.Context, id int64, isAdmin bool) error {
	return r.q.UpdateUserRole(ctx, repo.UpdateUserRoleParams{
		ID:      id,
		IsAdmin: isAdmin,
	})
}

func (r *userRepo) DeleteUser(ctx context.Context, id int64) error {
	return r.q.DeleteUser(ctx, id)
}

func toCoreUser(row repo.User) core.User {
	return core.User{
		ID:                   row.ID,
		Username:             row.Username,
		Password:             row.Password,
		SessionDurationHours: row.SessionDurationHours,
		IsAdmin:              row.IsAdmin,
	}
}
