FROM node:22-bookworm-slim AS base

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build

COPY package.json package-lock.json ./
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN npm ci

COPY prisma ./prisma
COPY prisma7.config.ts ./
# Generation needs the config to resolve a URL, but never connects to this DB.
# Supply runtime credentials only when starting the container.
RUN DATABASE_URL=postgresql://localhost:5432/build_only \
    npx prisma generate --config prisma7.config.ts \
    && npm prune --omit=dev

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json server.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node prisma ./prisma

RUN mkdir -p uploads/qr logs && chown -R node:node uploads logs
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/ready', {signal: AbortSignal.timeout(4000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
