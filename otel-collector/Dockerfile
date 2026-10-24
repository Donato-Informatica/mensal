# Collector image (PRD §8.7.4, ADR-0007): the contrib distribution with our
# config baked in, so Coolify needs no bind mount. Build context is this folder.
FROM otel/opentelemetry-collector-contrib:0.163.2
COPY config.yaml /etc/otelcol-contrib/config.yaml
