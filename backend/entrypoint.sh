#!/bin/bash
set -e

echo "Running migrations..."
GOOSE_DRIVER=postgres GOOSE_DBSTRING="${GOOSE_DBSTRING}" goose -dir ./migrations up

echo "Starting application..."
exec ./ecom
