#!/usr/bin/env bash
# CI (self-test.yml, Executable job): builds the single-file executable for this runner and uses it
# the way a teammate without Bun or Node would. `version` and `setup` must work before any settings
# exist; then a settings file named clickup-internal-mcp.env beside the executable (fake token,
# temporary cache) must be enough for an MCP client to list the tools and call them.
#
#   bash scripts/ci/binary-smoke.sh <bun target, e.g. windows-x64 or darwin-arm64>
set -euo pipefail
cd "$(dirname "$0")/../.." || exit 2
target="${1:?usage: binary-smoke.sh <target>}"

bun run build -- "$target"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
exe="$work/clickup-internal-mcp-$target"
[[ "$target" == windows-* ]] && exe="$exe.exe"
mv "dist/$(basename "$exe")" "$exe"
# Paths written into the settings file must be native: Git Bash prints /d/a/… from pwd; pwd -W
# prints D:/a/…. Elsewhere pwd -W does not exist and plain pwd is right.
native() { (cd "$1" && (pwd -W 2>/dev/null || pwd)); }

unset CLICKUP_API_TOKEN CLICKUP_WORKSPACE_ID CLICKUP_DATA_DIR CLICKUP_ENV_FILE
"$exe" version
"$exe" setup --client cursor | grep -q '"mcpServers"'
echo "ok    setup works before any settings exist"

token="$(printf 'pk_%s_%s' 0 "$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')")"
printf 'CLICKUP_API_TOKEN=%s\nCLICKUP_WORKSPACE_ID=1\nCLICKUP_DATA_DIR=%s/cache\n' "$token" "$(native "$work")" >"$work/clickup-internal-mcp.env"
bun scripts/ci/mcp-smoke.ts "$exe"
