# syntax=docker/dockerfile:1
# ════════════════════════════════════════════════════════════════════════════
#  Imagem única do Sistema BR4 Licitações
#  - Stage 1: builda o frontend web (Expo Router → SPA estática em /dist)
#  - Stage 2: instala dependências de produção do backend
#  - Stage 3: runtime Node que serve o estático E a API (/api) no mesmo domínio
# ════════════════════════════════════════════════════════════════════════════

# ─── Stage 1: build do frontend web (Expo) ───────────────────────────────────
FROM node:20-slim AS webbuild
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# API same-origin: o app chamará /api no MESMO domínio servido pelo backend
# (produção atrás do Traefik). String vazia ⇒ sem host/porta prefixados.
ENV API_URL=""
RUN npx expo export --platform web --output-dir dist

# ─── Stage 2: dependências de produção do backend ────────────────────────────
FROM node:20-slim AS apideps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend

# código do backend
COPY backend/ ./
# dependências de produção já resolvidas
COPY --from=apideps /app/backend/node_modules ./node_modules
# frontend web exportado → servido pelo Express (ver backend/src/app.js)
COPY --from=webbuild /app/dist ./public

ENV WEB_DIR=/app/backend/public
ENV PORT=3001
EXPOSE 3001

# healthcheck: o Traefik/Swarm só roteia quando /health responde 200
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/app.js"]
