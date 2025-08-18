# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies for server and client
COPY server/package.json server/package.json
COPY server/package-lock.json server/package-lock.json
COPY client/package.json client/package.json
COPY client/package-lock.json client/package-lock.json
COPY package.json package.json
COPY package-lock.json package-lock.json

RUN cd server && npm ci && cd .. \
 && cd client && npm ci && cd ..

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy server runtime pieces
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/server/node_modules server/node_modules
COPY --from=builder /app/server/package.json server/package.json
COPY --from=builder /app/server/data server/data

# Copy built client
COPY --from=builder /app/client/dist client/dist

EXPOSE 8080
CMD ["node", "server/dist/index.js"]