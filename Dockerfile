# Satu kontainer: build PWA lalu dilayani FastAPI bersama API di /api.
FROM node:22-slim AS web
WORKDIR /src
COPY shared ./shared
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --no-audit --no-fund
COPY frontend ./frontend
RUN cd frontend && npm run build

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 SANDAR_WEB_DIST=/app/web PORT=8000
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /src/frontend/dist ./web
EXPOSE 8000
# Layanan hosting seperti Render menentukan port lewat variabel PORT.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
