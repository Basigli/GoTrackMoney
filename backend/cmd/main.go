package main

import (
	"log/slog"
	"os"
)

func main() {
	// Logger
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	logger.Info("Hello world!")
}
