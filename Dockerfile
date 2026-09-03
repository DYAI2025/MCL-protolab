FROM node:24.19.0-alpine3.24 AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

FROM caddy:2.11.4-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

RUN addgroup -S -g 10001 mcl \
  && adduser -S -D -H -u 10001 -G mcl mcl \
  && mkdir -p /data /config \
  && chown -R mcl:mcl /srv /data /config

USER mcl

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
