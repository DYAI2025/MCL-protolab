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

for _ in $(seq 1 30); do
  if curl --fail --silent --show-error "${base_url}/healthz" >/dev/null; then
    break
  fi
  sleep 2
done

curl --fail --silent --show-error "${base_url}/healthz" | grep -qx 'ok'
curl --fail --silent --show-error "${base_url}/?experiment=world-editor-v1" >/dev/null
curl --fail --silent --show-error "${base_url}/ammo/ammo.wasm.wasm" >/dev/null
curl --fail --silent --show-error "${base_url}/assets/env/root_cluster_01.glb" >/dev/null

missing_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "${base_url}/definitely-missing")"
test "${missing_status}" = "404"

docker exec "${container_name}" sh -c 'test "$(id -u)" -ne 0'
test "$(docker inspect --format '{{.State.Health.Status}}' "${container_name}")" = "healthy"

echo "deployment container smoke passed: ${image_tag} on ${base_url}"
