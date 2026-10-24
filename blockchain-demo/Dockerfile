# One image runs the whole demo: FastAPI serves the API and the built React UI on port 8000.

# ---- stage 1: build the React frontend ---------------------------------------------------
FROM node:20-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---- stage 2: Python base with the backend and its runtime dependencies ------------------
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app/server
COPY server/requirements.txt ./
RUN pip install -r requirements.txt
COPY server/app ./app

# ---- optional stage: run the backend tests (docker build --target test .) ----------------
FROM base AS test
COPY server/requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
COPY server/pytest.ini ./
COPY server/tests ./tests
RUN python -m pytest -q

# ---- final stage: what actually runs ----------------------------------------------------
# The app looks for the UI at <project root>/web/dist, so it is copied to /app/web/dist.
FROM base AS runtime
COPY --from=web /web/dist /app/web/dist
RUN useradd --create-home --uid 10001 appuser
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/state', timeout=2)"
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
