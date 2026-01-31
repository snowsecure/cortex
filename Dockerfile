# CORTEX — Production Docker image
# Multi-stage: build frontend, then run Node server serving static + API

# -----------------------------------------------------------------------------
# Stage 1: Build frontend (Vite/React)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production image (API + static assets)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Healthcheck needs wget (not in minimal alpine)
RUN apk add --no-cache wget

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY db/ ./db/
COPY public/ ./public/
COPY --from=frontend-builder /app/dist ./dist

RUN mkdir -p /app/data && chown -R node:node /app/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

USER node
EXPOSE 3001

CMD ["node", "server.js"]
