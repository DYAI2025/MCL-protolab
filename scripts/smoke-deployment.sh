#!/usr/bin/env bash
set -euo pipefail

for command in docker curl; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "required command is unavailable: ${command}" >&2
    exit 127
  fi
done

image_tag="${IMAGE_TAG:-mcl-protolab:smoke}"
host_port="${HOST_PORT:-18080}"
container_name="mcl-protolab-smoke-$$"
base_url="http://127.0.0.1:${host_port}"

cleanup() {
  docker rm -f "${container_name}" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build --pull --tag "${image_tag}" .
docker run --detach \
  --name "${container_name}" \
  --publish "127.0.0.1:${host_port}:8080" \
  "${image_tag}" >/dev/null

http_ready=false
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error "${base_url}/healthz" >/dev/null; then
    http_ready=true
    break
  fi
  if test "$(docker inspect --format '{{.State.Running}}' "${container_name}")" != "true"; then
    echo "container stopped before HTTP readiness" >&2
    docker logs "${container_name}" >&2 || true
    exit 1
  fi
  sleep 2
done

if test "${http_ready}" != "true"; then
  echo "container did not become HTTP-ready" >&2
  docker logs "${container_name}" >&2 || true
  exit 1
fi

curl --fail --silent --show-error "${base_url}/healthz" | grep -qx 'ok'
curl --fail --silent --show-error "${base_url}/?experiment=world-editor-v1" >/dev/null
curl --fail --silent --show-error "${base_url}/ammo/ammo.wasm.wasm" >/dev/null
curl --fail --silent --show-error "${base_url}/assets/env/root_cluster_01.glb" >/dev/null

missing_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "${base_url}/definitely-missing")"
test "${missing_status}" = "404"

docker exec "${container_name}" sh -c 'test "$(id -u)" -ne 0'

health_status="starting"
for _ in $(seq 1 30); do
  health_status="$(docker inspect --format '{{.State.Health.Status}}' "${container_name}")"
  if test "${health_status}" = "healthy"; then
    break
  fi
  if test "${health_status}" = "unhealthy"; then
    docker logs "${container_name}" >&2 || true
    exit 1
  fi
  sleep 2
done

if test "${health_status}" != "healthy"; then
  echo "container health check timed out with status: ${health_status}" >&2
  docker logs "${container_name}" >&2 || true
  exit 1
fi

echo "deployment container smoke passed: ${image_tag} on ${base_url}"
