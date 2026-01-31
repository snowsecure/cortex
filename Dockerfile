# SAIL-IDP Docker Image
# Multi-stage build for optimized production image

# ============================================================================
# Stage 1: Build frontend
# ============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source files
COPY . .

# Build frontend
RUN npm run build

# ============================================================================
# Stage 2: Production image
# ============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Copy backend files
COPY server.js ./
COPY db/ ./db/

# Copy public assets
COPY public/ ./public/

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R node:node /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run as non-root user
USER node

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "server.js"]
