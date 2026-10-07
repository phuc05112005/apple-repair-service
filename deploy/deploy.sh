#!/bin/sh
set -eu

STACK_DIR=${STACK_DIR:-/srv/apple-repair-service}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}

cd "$STACK_DIR"

if [ ! -f .env ]; then
  echo "Deployment stopped: $STACK_DIR/.env is missing." >&2
  exit 1
fi

deploy_current_environment() {
  docker compose -f "$COMPOSE_FILE" pull
  docker compose -f "$COMPOSE_FILE" up -d --wait --wait-timeout 180
}

if deploy_current_environment; then
  docker compose -f "$COMPOSE_FILE" ps
  echo "Deployment healthchecks passed."
  exit 0
fi

echo "Deployment failed; attempting rollback to .env.previous." >&2
if [ ! -f .env.previous ]; then
  echo "Rollback unavailable because no previous environment snapshot exists." >&2
  docker compose -f "$COMPOSE_FILE" ps >&2 || true
  exit 1
fi

cp .env.previous .env
if deploy_current_environment; then
  echo "Rollback completed and previous services are healthy." >&2
else
  echo "Rollback also failed; operator intervention is required." >&2
  docker compose -f "$COMPOSE_FILE" ps >&2 || true
fi
exit 1
