#!/bin/bash
# SessionStart hook (.claude/settings.json) that readies a Claude Code cloud
# session: Node 24, dependencies, and the Postgres 17 from docker-compose.yml,
# migrated. Outside the cloud (CLAUDE_CODE_REMOTE != true) it does nothing.
# Idempotent, so it is safe on resume. Its stdout reaches Claude as context.

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 1

log=/tmp/mensal-cloud-setup.log
: > "$log"
fail() {
  echo "Cloud setup failed: $1. Details in $log:"
  tail -n 20 "$log"
  exit 1
}

# The cloud image ships Node 20–22 under /opt; package.json needs >= 24.
node_dir=/opt/node24
if [ ! -x "$node_dir/bin/node" ]; then
  case "$(uname -m)" in
    x86_64) arch=x64 ;;
    aarch64) arch=arm64 ;;
    *) fail "unsupported architecture $(uname -m)" ;;
  esac
  base=https://nodejs.org/dist/latest-v24.x
  tarball=$(curl -fsSL "$base/SHASUMS256.txt" | awk -v a="linux-$arch.tar.xz" '$2 ~ a"$" { print $2 }')
  [ -n "$tarball" ] || fail "could not find the Node 24 tarball"
  mkdir -p "$node_dir"
  curl -fsSL "$base/$tarball" | tar -xJ -C "$node_dir" --strip-components=1 >> "$log" 2>&1 \
    || { rm -rf "$node_dir"; fail "Node 24 download"; }
fi
export PATH="$node_dir/bin:$PATH"
# Later Bash commands in the session see Node 24 too.
[ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export PATH=\"$node_dir/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"

# Reinstall only when a manifest, the lockfile or this script changed.
hashes=node_modules/.cloud-setup.sha256
manifests=(scripts/cloud-session-start.sh package.json package-lock.json apps/*/package.json packages/*/package.json)
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  npm ci >> "$log" 2>&1 || fail "npm ci"
  sha256sum "${manifests[@]}" > "$hashes"
fi

if ! docker info > /dev/null 2>&1; then
  service docker start >> "$log" 2>&1 || (dockerd >> "$log" 2>&1 &)
  for _ in $(seq 30); do
    docker info > /dev/null 2>&1 && break
    sleep 1
  done
fi
docker compose up -d --wait postgres >> "$log" 2>&1 || fail "starting Postgres"
npm run migrate >> "$log" 2>&1 || fail "migrating the database"

echo "Cloud setup ready: Node $(node --version), dependencies installed, Postgres 17 on localhost:5432 (migrated). npm run check works as documented in AGENTS.md."
