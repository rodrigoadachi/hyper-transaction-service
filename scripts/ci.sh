#!/usr/bin/env bash
# Executa o pipeline de qualidade completo: lint → audit → build
# Uso: ./scripts/ci.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_DIR="$(dirname "$SCRIPT_DIR")"

cd "$MONOREPO_DIR"

# Carrega nvm se disponível e seleciona a versão do .nvmrc
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
  nvm use
elif command -v fnm &>/dev/null; then
  fnm use
fi

echo "▶ node $(node --version) | pnpm $(pnpm --version)"
echo ""

echo "── lint ──────────────────────────────────────────────"
pnpm lint

echo ""
echo "── audit ─────────────────────────────────────────────"
pnpm audit

echo ""
echo "── build ─────────────────────────────────────────────"
pnpm build

echo ""
echo "✓ CI pipeline concluído com sucesso"
