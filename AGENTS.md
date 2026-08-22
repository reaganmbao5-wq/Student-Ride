# Workspace Rules for Mapbox Stable & Student-Ride Project

## 1. Autonomous Execution
Always proceed autonomously. Do not ask for permissions to run codes, shell commands, Python scripts, Android builds, or tests. Always execute verification proactively.

## 2. Strict Zero-Omission Commit & Feature Fidelity Rule
* **Mandatory Full-Diff Audit**: Before implementing any bundle or referencing historical commits (e.g. ba1e7c, 996d75c, 42ab201), the agent must inspect EVERY file in the git diff (git show --stat <commit> and git diff <commit>^..<commit>).
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
