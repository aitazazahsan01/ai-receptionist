FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY apps/backend/. .
RUN npx prisma generate
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD ["node", "-e", "require('http').get('http://localhost:4000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"]

# Applies any pending migrations before starting -- safe to run on every
# container start since `migrate deploy` is a no-op when nothing is pending.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
