# Build context is the repository root, so existing FLOCK art/catalog are included.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/bot
COPY bot/package.json bot/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY bot/src ./src
COPY public/flock /app/public/flock
RUN mkdir -p /data
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
CMD ["node", "src/main.mjs"]
