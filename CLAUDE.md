# CLAUDE.md: how to work on this project

Claude Code loads this file automatically at the start of every session. Keep it short: rules and commands only.
Status lives in `PROJECT_CONTEXT.md`; durable knowledge lives in `docs/`.

## 1. Start of every session
1. Read `PROJECT_CONTEXT.md`. A session-start hook (`.claude/settings.json`) also injects it at startup and after
   every context compaction. If it's missing or still the empty template, fill it in from the repo.
2. Open files in `docs/` only when the task needs them (index: `docs/README.md`).

## 2. Owner's working rules (same in every project)
- Act as an expert in whatever the project needs (state the roles in "Project specifics" below) and as a Claude Code expert.
- **"Just answer" / "don't update anything until I say okay"** means answer only, with no file, code or git changes,
  until the owner says "okay".
- Explain plainly; give direct links to anything the owner needs to open or download.
- Don't open pull requests unless asked. Don't add paid services or API keys without asking.

## 3. Keeping context (don't lose work at the token limit)
| When | Update |
|---|---|
| After each finished task or commit | `PROJECT_CONTEXT.md` → "Current session" and "Done" |
| When a long session is getting large, and before ending the session | `PROJECT_CONTEXT.md` (full refresh) |
| A method, data source or architecture changes | the matching `docs/*.md`, plus a dated line in `docs/decisions.md` |
| The way of working changes (commands, rules) | this `CLAUDE.md` |

- Only one context file: `PROJECT_CONTEXT.md`. Never create another. Keep it under about 150 lines; move durable
  detail into `docs/`.
- Commit context and docs changes (the cloud container is wiped after a session; only what's pushed survives).

## 4. Project specifics
- **Expert roles:** front-end web developer (vanilla JS, PWA), personal-finance / portfolio-accounting analyst.
- **Commands:**
  ```bash
  # test:  npm test            (node --test, Node 20+)
  # build: none (static files in app/)
  # run:   npm start           (http://localhost:8080)
  ```
- **Working branch:** the session's assigned branch; GitHub Pages deploys from `main`.
- **Environment facts:** the cloud container can't reach mrinvestapp.com (proxy blocks it). Chromium + Playwright are
  pre-installed for screenshots and browser checks.
- **Conventions:** no dependencies or build step. All money maths goes in `app/js/portfolio.js` (pure, tested); DOM code
  in `app/js/app.js`. Add a test for any maths change. Bump `CACHE` in `app/sw.js` when shipping UI changes.
