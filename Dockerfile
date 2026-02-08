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

# Build with empty API URL so frontend uses relative URLs (same-origin)
ENV VITE_API_URL=""
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production image (API + static assets)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install build tools for native modules (better-sqlite3) and wget for healthcheck
RUN apk add --no-cache wget python3 make g++

WORKDIR /app

COPY package*.json ./

# Install production dependencies (includes native module compilation)
RUN npm ci --omit=dev && npm cache clean --force

# Remove build tools to reduce image size (native modules already compiled)
RUN apk del python3 make g++

# Copy application files
COPY server.js ./
COPY db/ ./db/
COPY public/ ./public/
COPY --from=frontend-builder /app/dist ./dist

# Create data directory with correct permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3005
ENV DB_PATH=/app/data
ENV CORS_ORIGIN=*
ENV CORS_ORIGIN=https://cortex.stewart.com

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3005/health || exit 1

# Run as non-root user
USER node
EXPOSE 3005

CMD ["node", "server.js"]
