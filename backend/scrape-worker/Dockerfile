# Imagem do scrape-worker — base oficial do Playwright (já traz Chromium + libs).
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app/backend

# deps de produção do backend (reusamos db.js, ingest/upsert.js, normalize.js)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# código do backend (o worker faz require de ../src/...)
COPY backend/ ./

# deps do worker. O Chromium já vem na imagem base do Playwright — não rebaixa.
WORKDIR /app/backend/scrape-worker
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --omit=dev

# roda como usuário sem privilégios (boa prática p/ browser headless)
USER pwuser

CMD ["node", "index.js"]
