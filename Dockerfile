# API image (PRD §8.1, §8.4): only the api, shared and database workspaces.
# The web app is built separately (`npm run build:web`) and served as static files.
#
#   docker build -t mensal-api .
#   docker run -p 3000:3000 -e DATABASE_URL=... -e BETTER_AUTH_URL=... -e BETTER_AUTH_SECRET=... mensal-api
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

# Manifests first, so the install layer is cached until a dependency changes.
# --ignore-scripts skips the root `prepare` (skill links and husky, dev only).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY apps/api apps/api
COPY packages/shared packages/shared
COPY packages/database packages/database

USER node
EXPOSE 3000

# drizzle-kit applies pending migrations before the API starts (PRD §8.3:
# never `auth migrate`). The DATABASE_URL guard matters: drizzle.config.ts
# falls back to localhost when it is unset. `exec node` rather than the api's
# `npm start` makes Node PID 1, so it receives SIGTERM. SEED_DEMO_DATA=true
# (set only in Coolify's preview environment) also loads the demo data; a
# failed seed is logged and never blocks boot. `--import` loads the telemetry
# hook before the server; it does nothing unless OTEL_EXPORTER_OTLP_ENDPOINT is
# set (PRD §8.7.4).
CMD ["sh", "-c", ": \"${DATABASE_URL:?is not set}\" && npm run --silent -w @mensal/database migrate && { [ \"$SEED_DEMO_DATA\" != true ] || node apps/api/src/seed-cli.ts || echo \"demo seed failed\"; } && exec node --import ./apps/api/src/instrumentation.ts apps/api/src/server.ts"]
