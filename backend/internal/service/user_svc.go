package service

import (
	"context"
	"errors"
	"time"

	"github.com/sikozonpc/ecom/internal/core"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUsernameTaken      = errors.New("username already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

type UserService interface {
	ListUsers(ctx context.Context) ([]core.User, error)
	CreateUser(ctx context.Context, username, password string) (core.User, error)
	UpdateUser(ctx context.Context, id int64, username, password string, sessionDurationHours int32) (core.User, error)
	DeleteUser(ctx context.Context, id int64) error
	AuthenticateUser(ctx context.Context, username, password string) (core.User, error)
	AdminResetUserPassword(ctx context.Context, id int64) (string, error)
}

type userService struct {
	repo core.UserRepository
}

func NewUserService(repo core.UserRepository) UserService {
	return &userService{repo: repo}
}

func (s *userService) ListUsers(ctx context.Context) ([]core.User, error) {
	return s.repo.ListUsers(ctx)
}

func (s *userService) CreateUser(ctx context.Context, username, password string) (core.User, error) {
	if username == "" {
		return core.User{}, errors.New("username is required")
	}
	if password == "" {
		return core.User{}, errors.New("password is required")
	}

	existing, err := s.repo.FindUserByUsername(ctx, username)
	if err == nil && existing.ID != 0 {
		return core.User{}, ErrUsernameTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return core.User{}, err
	}

	count, err := s.repo.CountUsers(ctx)
	if err != nil {
		return core.User{}, err
	}

	user, err := s.repo.CreateUser(ctx, username, string(hash))
	if err != nil {
		return core.User{}, err
	}

	if count == 0 {
		if err := s.repo.UpdateUserRole(ctx, user.ID, true); err == nil {
			user.IsAdmin = true
		}
	}

	return user, nil
}

func (s *userService) UpdateUser(ctx context.Context, id int64, username, password string, sessionDurationHours int32) (core.User, error) {
	var hashStr string
	if password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return core.User{}, err
		}
		hashStr = string(hash)
	}

	if username != "" {
		existing, err := s.repo.FindUserByUsername(ctx, username)
		if err == nil && existing.ID != id {
			return core.User{}, ErrUsernameTaken
		}
	}

	return s.repo.UpdateUser(ctx, id, username, hashStr, sessionDurationHours)
}

func (s *userService) DeleteUser(ctx context.Context, id int64) error {
	return s.repo.DeleteUser(ctx, id)
}

func (s *userService) AuthenticateUser(ctx context.Context, username, password string) (core.User, error) {
	if username == "" || password == "" {
		return core.User{}, ErrInvalidCredentials
	}

	user, err := s.repo.FindUserByUsername(ctx, username)
	if err != nil {
		return core.User{}, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return core.User{}, ErrInvalidCredentials
	}

	return user, nil
}

func (s *userService) AdminResetUserPassword(ctx context.Context, id int64) (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
		time.Sleep(1 * time.Nanosecond)
	}
	tempPassword := string(b)

	hash, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	_, err = s.repo.UpdateUser(ctx, id, "", string(hash), 0)
	if err != nil {
		return "", err
	}

	return tempPassword, nil
}
