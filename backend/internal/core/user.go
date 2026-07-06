package core

import "context"

type User struct {
	ID                   int64
	Username             string
	Password             string // Hashed
	SessionDurationHours int32
	IsAdmin              bool
}

type UserRepository interface {
	ListUsers(ctx context.Context) ([]User, error)
	FindUserByUsername(ctx context.Context, username string) (User, error)
	CountUsers(ctx context.Context) (int64, error)
	CreateUser(ctx context.Context, username, hashedPassword string) (User, error)
	UpdateUser(ctx context.Context, id int64, username, hashedPassword string, sessionDuration int32) (User, error)
	UpdateUserRole(ctx context.Context, id int64, isAdmin bool) error
	DeleteUser(ctx context.Context, id int64) error
}
