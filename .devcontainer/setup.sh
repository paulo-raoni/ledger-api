#!/bin/bash
set -e

# Load env vars from .env local se existir
if [ -f /workspaces/ledger-api/.devcontainer/.env ]; then
  set -a
  source /workspaces/ledger-api/.devcontainer/.env
  set +a
  echo 'set -a; source /workspaces/ledger-api/.devcontainer/.env; set +a' >> ~/.bashrc
fi

# Install Claude Code
curl -fsSL https://claude.ai/install.sh | bash || true
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"

# Install OMC CLI (Linux-compatible binaries)
npm install -g oh-my-claude-sisyphus@latest

# Git identity
if [ -n "$GIT_USER_EMAIL" ]; then
  git config --global user.email "$GIT_USER_EMAIL"
fi
if [ -n "$GIT_USER_NAME" ]; then
  git config --global user.name "$GIT_USER_NAME"
fi

# GitHub CLI auth
if [ -n "$GITHUB_TOKEN" ]; then
  echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
fi

# Git hooks
if [ -d .githooks ]; then
  git config core.hooksPath .githooks
  chmod +x .githooks/*
fi

# Install root dependencies
if [ -f package.json ]; then
  npm install
fi

echo "✓ Setup complete."