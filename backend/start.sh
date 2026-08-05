#!/bin/bash
# Runs Celery worker + beat alongside the API in this one Render service.
#
# ponytail: single-instance only. Beat must never run more than once — if
# this service is ever scaled to 2+ instances, duplicate beat schedulers
# will double-fire dispatch/settlement tasks. Split beat into its own
# Render service before scaling web instances past 1.
set -e

celery -A app.workers.celery_app worker --loglevel=info --concurrency=2 &
celery -A app.workers.celery_app beat --loglevel=info &
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 4 --loop uvloop --http httptools --access-log &

# If any of the three dies, exit so Render restarts the whole container —
# a bare `&` background process dying silently is the exact bug this fixes.
wait -n
exit $?
