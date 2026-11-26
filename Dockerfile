# Stage 1: Build client
FROM node:22-alpine AS client-build
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy root and workspace manifests so npm ci resolves cleanly
COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built client and server source
COPY --from=client-build /app/dist ./dist
COPY server ./server
COPY server.ts ./server.ts
COPY tsconfig.json ./tsconfig.json

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start server (Node 22 native TypeScript execution)
CMD ["node", "server.ts"]
