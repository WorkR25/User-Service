# syntax=docker/dockerfile:1

# ---- build: install all deps and compile TypeScript -> dist/ ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json .sequelizerc ./
COPY src ./src
RUN npx tsc -p tsconfig.json

# ---- migrate: one-off job image that applies Sequelize migrations ----
# sequelize-cli + ts-node are devDependencies and the migrations are .ts files, so this reuses the build stage.
#   docker compose --profile migrate run --rm migrate
FROM build AS migrate
ENV NODE_ENV=production
CMD ["npx", "sequelize-cli", "db:migrate", "--env", "production"]

# ---- deps: production node_modules only ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime (default target: must stay the last stage) ----
FROM node:22-slim AS runtime
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA
ENV NODE_ENV=production \
    TZ=Asia/Kolkata
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# winston-daily-rotate-file writes to ./logs (mounted as a volume by docker-compose)
RUN mkdir -p logs && chown -R node:node /app/logs
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
