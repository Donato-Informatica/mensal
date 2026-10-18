# Web image (PRD §8.4): the static build served by nginx, which also forwards
# /api to the API container so the browser only ever sees one origin.
# Build with the repository root as context:
#
#   docker build -f apps/web/Dockerfile -t mensal-web .
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN npm run build:web

FROM nginx:1-alpine
# The nginx image renders /etc/nginx/templates/*.template into conf.d at start.
# Only API_HOST is substituted, so nginx's own $variables stay intact.
ENV API_HOST=api NGINX_ENVSUBST_FILTER=^API_HOST$
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
