# AI Fabrix Miso Controller - Optimized Dockerfile
FROM node:18-alpine

# Install only essential runtime dependencies
RUN apk add --no-cache \
    curl \
    wget \
    openssl \
    openssl-dev

# Install PNPM globally
RUN npm install -g pnpm

# Install tsconfig-paths globally for path resolution
RUN npm install -g tsconfig-paths

# Set working directory
WORKDIR /app

# Copy package files for dependency resolution
COPY package*.json ./
COPY pnpm-workspace.yaml ./
COPY packages/miso-azure/package*.json ./packages/miso-azure/
COPY packages/miso-controller/package*.json ./packages/miso-controller/
COPY packages/miso-controller/bin ./packages/miso-controller/bin
COPY packages/miso-ui/package*.json ./packages/miso-ui/

# Create .npmrc for hoisting to fix module resolution in Docker
RUN echo "shamefully-hoist=true" > .npmrc

# Install all dependencies (including dev for building)
RUN pnpm install

# Copy only the source code we need
COPY packages/miso-azure/src ./packages/miso-azure/src
COPY packages/miso-azure/tsconfig.json ./packages/miso-azure/
COPY packages/miso-controller/src ./packages/miso-controller/src
COPY packages/miso-controller/tsconfig.json ./packages/miso-controller/
COPY packages/miso-controller/tsconfig.docker.json ./packages/miso-controller/
COPY packages/miso-controller/openapi/openapi-complete.yaml ./packages/miso-controller/dist/openapi/
COPY packages/miso-controller/openapi/openapi-complete.json ./packages/miso-controller/dist/openapi/
COPY packages/miso-ui/src ./packages/miso-ui/src
COPY packages/miso-ui/tsconfig.json ./packages/miso-ui/
COPY packages/miso-ui/tsconfig.app.json ./packages/miso-ui/
COPY packages/miso-ui/tsconfig.node.json ./packages/miso-ui/
COPY packages/miso-ui/vite.config.ts ./packages/miso-ui/
COPY packages/miso-ui/index.html ./packages/miso-ui/

# Fix Rollup native module issue for Alpine Linux
RUN pnpm add @rollup/rollup-linux-x64-musl @types/express-serve-static-core --workspace-root

# Build packages
WORKDIR /app/packages/miso-azure
RUN pnpm run build

WORKDIR /app/packages/miso-ui  
RUN pnpm run build

WORKDIR /app/packages/miso-controller
RUN pnpm run db:generate
RUN pnpm exec tsc -p tsconfig.docker.json || true
# Copy sensitive-fields.config.json to dist folder
RUN mkdir -p dist/src/services/logging && \
    cp src/services/logging/sensitive-fields.config.json dist/src/services/logging/ || true
# Copy generated Prisma logs client to dist folder (needed at runtime)
RUN mkdir -p dist/database/generated && \
    cp -r src/database/generated/logs-client dist/database/generated/ || true

# Return to root to prune correctly (needed to keep workspace dependencies)
WORKDIR /app

# Remove source files and build artifacts, but preserve Prisma schema files and OpenAPI files
RUN mkdir -p packages/miso-controller/dist/database/prisma && \
    cp packages/miso-controller/src/database/prisma/*.prisma packages/miso-controller/dist/database/prisma/ || true
RUN rm -rf packages/miso-azure/src packages/miso-controller/src packages/miso-ui/src
RUN rm -rf packages/miso-azure/tsconfig.json packages/miso-ui/tsconfig.json
RUN rm -rf packages/*/node_modules packages/*/.git packages/*/.github

# Reinstall to recreate symlinks after removing source files
# This ensures workspace dependencies are properly linked
RUN pnpm install --frozen-lockfile --filter "@aifabrix/miso-controller..." || pnpm install --frozen-lockfile

# Manually remove known dev dependencies
RUN rm -rf node_modules/markdownlint node_modules/markdownlint-cli node_modules/prettier
RUN rm -rf .pnpm/markdownlint* .pnpm/prettier*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S miso -u 1001

# Create necessary directories for mount points (with fallback to local storage)
RUN mkdir -p /mnt/data/logs /mnt/data/data /mnt/data/backup /mnt/data/config
RUN mkdir -p /app/data/logs /app/data/data /app/data/backup /app/data/config

# Change ownership of app directory and mount points
RUN chown -R miso:nodejs /app /mnt/data

# Switch to non-root user
USER miso

# Set working directory to controller
WORKDIR /app/packages/miso-controller

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set environment variable for tsconfig-paths
ENV TS_NODE_PROJECT=tsconfig.docker.json

# Set default data paths (can be overridden by environment variables)
ENV LOG_PATH=/mnt/data/logs
ENV DATA_PATH=/mnt/data/data
ENV BACKUP_PATH=/mnt/data/backup
ENV CONFIG_PATH=/mnt/data/config

# Create symlinks for fallback to local storage if mounts are not provided
RUN ln -sf /app/data/logs /mnt/data/logs || true
RUN ln -sf /app/data/data /mnt/data/data || true  
RUN ln -sf /app/data/backup /mnt/data/backup || true
RUN ln -sf /app/data/config /mnt/data/config || true

# Start the application
CMD ["node", "-r", "tsconfig-paths/register", "dist/src/server.js"]

