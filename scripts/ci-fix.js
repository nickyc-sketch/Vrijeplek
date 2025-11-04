name: Vrijeplek CI (check & self-fix)

on:
  push:
    branches: [ main ]   # ← PAS DIT AAN naar jouw default branch (bv. master)
  pull_request:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: write  # nodig om auto-fixes te committen

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install deps (best-effort)
        run: |
          npm ci || npm install

      - name: Run self-fixer
        run: node scripts/ci-fix.js

      - name: Commit & push auto-fixes (indien nodig)
        run: |
          if ! git diff --quiet; then
            git config user.name "vrijeplek-ci-bot"
            git config user.email "ci@vrijeplek.local"
            git add -A
            git commit -m "ci: autofix Netlify Functions & config"
            git push
          else
            echo "Geen wijzigingen nodig."
          fi

      - name: Lint (niet blokkerend)
        run: npx eslint . --ext .js || true

      - name: Bundle Functions (check resolvability)
        run: npx @netlify/zip-it-and-ship-it netlify/functions dist_functions

      - name: Summary
        run: echo "✅ CI klaar"
