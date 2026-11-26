# REGEN HIS - app image (Stage 1).
# Keeps dev dependencies so the container can run database migrations and the demo seed on start.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Asia/Kuala_Lumpur
EXPOSE 3000
RUN chmod +x scripts/docker-entrypoint.sh
CMD ["scripts/docker-entrypoint.sh"]
