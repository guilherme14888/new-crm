# Imagem do scrape-worker — base oficial do Playwright (já traz Chromium + libs).
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app/backend

# deps de produção do backend (reusamos db.js, ingest/upsert.js, normalize.js)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# código do backend (o worker faz require de ../src/...)
COPY backend/ ./

# deps do worker (playwright já está na imagem base; instala o que falta)
WORKDIR /app/backend/scrape-worker
RUN npm install --omit=dev

# roda como usuário sem privilégios (boa prática p/ browser headless)
USER pwuser

CMD ["node", "index.js"]
