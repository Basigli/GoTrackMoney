FROM golang:alpine AS builder

WORKDIR /app

# Install dependencies and build tools
RUN apk add --no-cache git

# Copy go mod and sum files
COPY go.mod go.sum ./
RUN go mod download

# Build goose migration tool (do this before copying source to cache it)
RUN go install github.com/pressly/goose/v3/cmd/goose@latest

# Copy the source code
COPY . .

# Build the Go app
RUN CGO_ENABLED=0 GOOS=linux go build -o ecom ./cmd

FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata bash

# Copy the binary and goose
COPY --from=builder /app/ecom .
COPY --from=builder /go/bin/goose /usr/local/bin/goose

# Copy migrations
COPY --from=builder /app/internal/adapters/postgresql/migrations ./migrations

# Create an entrypoint script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 8098

ENTRYPOINT ["./entrypoint.sh"]
