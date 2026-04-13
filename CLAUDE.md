CLAUDE.md — ledger-api

This file is the operational contract for Claude Code working inside this repository.
Read it completely before touching any file.

1. Project Identity
   ledger-api is a reference implementation of a financial ledger built with Node.js microservices.
   It demonstrates fintech-grade reliability patterns: ACID transactions, idempotency keys,
   optimistic locking for concurrency, and secure inter-service JWT authentication.
   This is NOT a production product. It is a technical demonstration of decisions
   a senior engineer would make in a real transactional system.
   Stack: Node.js, Fastify, PostgreSQL, Docker, JWT, ESM modules, Jest

2. Workflow
   OMC (oh-my-claudecode) is the orchestration layer between claude.ai and Claude Code CLI.

claude.ai → strategic decisions, proposals, prompt generation, handoffs
OMC → orchestration, agent delegation, planning (ralplan), execution (ralph)
Claude Code CLI → implementation + opens PR (primary executor, invoked via OMC)
Operator → merge on GitHub, manual validation

Complete PR flow:
claude.ai generates prompt and saves as .md if long
OMC orchestrates: ralplan for planning, ralph/executor for implementation
Claude Code CLI implements + opens PR
claude.ai generates review prompt for the extension — always from local changes, not the PR
Extension reviews in plan mode
If issues → Claude Code CLI fixes on the same branch (via OMC)
Extension confirms → operator merges on GitHub
Manual verification by operator after merge

3. Sources of Truth
   Read in this order before making any change:
   docs/PROGRESS.md — what milestones are done, in progress, and next
   docs/DECISIONS.md — index of key decisions
   docs/BACKLOG.md — future ideas, not committed scope

4. Project Structure
   ledger-api/
   ├── apps/
   │ ├── ledger/ # Ledger microservice (port 3001) — transactions, balance, wallet
   │ └── identity/ # Identity microservice (port 3002) — users, auth
   ├── packages/
   │ └── shared/ # Shared code — JWT, error handling, logger, env loader
   ├── docs/ # Milestone tracking, decisions, backlog
   ├── .devcontainer/ # Devcontainer configuration (sensitive path)
   ├── .githooks/ # Git hooks (sensitive path)
   ├── docker-compose.yml
   └── .env.example

5. Development Philosophy
   Milestone-first — one milestone at a time, no exceptions
   Evidence-gated — a milestone is not done until its gate criteria pass
   Minimalism — if it is not needed now, do not add it
   Governance over improvisation — every structural decision must be recorded
   Clarity over creativity — name things exactly as they are
   Control over speed — never advance a milestone without audit evidence

6. Working Protocol

Before starting any task
Read docs/PROGRESS.md to confirm the current milestone scope.
Read docs/DECISIONS.md to understand key decisions already made.
Confirm the task does not touch sensitive paths (see Section 10).
Run the baseline health check:
npm run typecheck
npm run lint
npm test
If any gate fails, STOP and report. Do not begin implementation until all gates pass.

During implementation
One objective per branch. Branch names must describe the work.
Prefer small, scoped changes.
Run CI gates after every meaningful change.
Never commit build artifacts, database files, or logs.

After completing a task
Return this audit package: 1. Branch used 2. Files changed and why 3. git diff --stat 4. npm run typecheck output (pass/fail) 5. npm run lint output (pass/fail) 6. npm test output (pass/fail) 7. README reviewed and no changes required. (or: README updated.) 8. Summary of what was delivered
Missing the documentation declaration invalidates the delivery.

PR description rules:
Use the body provided in the prompt as-is.
Do not add sections not requested.
Never auto-generate a "Test plan" section with unchecked checkboxes.
If the tool generates one automatically, remove it before opening the PR.

7. CI Gates — Non-Negotiable
   These commands must pass before any delivery:
   npm run typecheck
   npm run lint
   npm test

A delivery where any gate fails is not a delivery.

Gate policy by PR type:
PR type Gates required
Code changes (.ts, .tsx) typecheck + lint + test
Config changes (.json) typecheck
Documentation only (.md) none

8. Milestone Discipline
   One milestone at a time. No exceptions.
   Do not implement future milestones.
   Do not expand scope.
   Do not merge concerns from different milestones into one branch.
   If work reveals a gap belonging to a future milestone, record it in docs/BACKLOG.md and continue.
   Backlog items are future ideas, not committed scope.

9. Git Rules
   Never push directly to main — branch is protected
   Never rebase or force-push without seeing the git graph first
   Always create a branch, even for 1-line fixes
   Commit messages: follow Conventional Commits.
   Examples: feat: add login flow, fix: off-by-one in counter, chore: update deps, docs: M2 decisions.
   Branch naming convention:
   Prefix When to use
   feat/mN-description milestone implementation
   fix/description bug fix
   chore/description infra, deps, setup
   doc/description documentation only
   bootstrap/description initial structure

10. Sensitive Paths — Never modify without explicit operator approval
    CLAUDE.md
    docs/PROGRESS.md
    docs/BACKLOG.md
    docs/DECISIONS.md
    docs/decisions/
    .githooks/
    .devcontainer/

11. Language
    All code, commits, PRs, docs, and comments are in English. No exceptions.

12. Forbidden Behaviors
    Never do any of the following without explicit operator approval:
    Modify sensitive paths (Section 10)
    Implement future milestones or backlog items
    Expand milestone scope during implementation
    Commit directly to main
    Auto-merge pull requests
    Bypass CI gates or suppress their output
    Commit .db, .sqlite, \*.log, or dist/ files
    Run git add . — always stage files explicitly by path
    Auto-generate "Test plan" sections with unchecked checkboxes in PR descriptions

13. Change Proposal Protocol
    If you identify a necessary structural change, a governance gap, or a conflict:
    STOP.
    State clearly what the issue is.
    Identify which documents or modules are in conflict.
    Propose a specific resolution.
    Wait for explicit operator approval before proceeding.

14. Executor Invocation
    OMC is the primary orchestration layer. Ralph mode is the canonical execution driver.
    ralph: [objective] — persistent execution until verified complete
    ralplan: [objective] — iterative planning with operator approval before execution
    /team N:executor "[objective]" — coordinated parallel agents for large tasks

Direct CLI invocation (when running outside OMC):
claude --dangerously-skip-permissions < prompt.md
Only use inside the devcontainer or a trusted isolated environment.
