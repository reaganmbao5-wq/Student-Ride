# Workspace Rules for Mapbox Stable & Student-Ride Project

## 1. Autonomous Execution
Always proceed autonomously. Do not ask for permissions to run codes, shell commands, Python scripts, Android builds, or tests. Always execute verification proactively.

## 2. Strict Zero-Omission Commit & Feature Fidelity Rule
* **Mandatory Full-Diff Audit**: Before implementing any bundle or referencing historical commits (e.g.  ba1e7c, 996d75c, 42ab201), the agent must inspect EVERY file in the git diff (git show --stat <commit> and git diff <commit>^..<commit>).
* **Complete Surface Implementation**:
  - Backend endpoints, database models, and service helpers.
  - Frontend pages, sub-pages, routes in App.js, and navigation bars.
  - UI triggers (e.g., buttons, modals, dropdown options, and role filters).
  - State handling, caching, and WebSocket dispatch synchronization.
* **No Partial Migrations**: Never mark a bundle or feature complete if any secondary UI element, filter, or modal is omitted.
* **Pre-Flight Diff Verification**: Verify all modifications against the reference commit before finalizing.

## 3. UI/UX & Canvas Stability Lock
* Bottom sheet height must remain strictly bounded (zero GPU lag, 260px envelope).
* No unnecessary full-page spinners or layout flashes during WebSocket reconnects.

## 4. Two-Stage Deployment & Preview Verification Protocol
* **Stage 1 (Preview Deployment First)**:
  - Whenever a new feature, UI tweak, or bugfix is implemented and built, the agent MUST first deploy it to the Cloudflare Pages **Preview** environment:
    ```powershell
    $env:CLOUDFLARE_API_TOKEN="cfut_5d1g2wlhu0KIUO2s8IkCs8RUC5FBaipkmOxB5gnr357a6b1a"; $env:CLOUDFLARE_ACCOUNT_ID="e7aefea51ed01f0d2d0d7f1b8c3518eb"; npx wrangler pages deploy build --project-name=jaey-ride --branch=staging --commit-dirty=true
    ```
  - The agent MUST extract and report the generated **Preview URL** (e.g., `https://<hash>.jaey-ride.pages.dev`) directly to the user for physical & end-to-end testing.
  - The agent MUST NEVER push or promote directly to the live Production URL (`jaeyride.site`) without explicit user sign-off.
* **Stage 2 (User Sign-Off & Production Promotion)**:
  - The user tests the preview URL and confirms everything functions properly.
  - Upon receiving the user's explicit approval / go-ahead, the agent then promotes the build to the Cloudflare Pages **Production** environment:
    ```powershell
    $env:CLOUDFLARE_API_TOKEN="cfut_5d1g2wlhu0KIUO2s8IkCs8RUC5FBaipkmOxB5gnr357a6b1a"; $env:CLOUDFLARE_ACCOUNT_ID="e7aefea51ed01f0d2d0d7f1b8c3518eb"; npx wrangler pages deploy build --project-name=jaey-ride --branch=production --commit-dirty=true
    ```
  - Verify that the live domain (`https://jaeyride.site`) is serving the new bundle with zero regressions.

## 5. Strict UI Iconography Rule: No AI-Like Stars
- **NEVER use AI-like stars, sparkle icons (e.g. `Sparkle` from Lucide or Phosphor), or star emojis (e.g. `⭐`) on any UI buttons, badges, status pills, or controls.**
- All UI elements, badges, and buttons must use standard, professional iconography (e.g., `ShieldCheck`, `Check`, `Users`, or plain clean typography).

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
