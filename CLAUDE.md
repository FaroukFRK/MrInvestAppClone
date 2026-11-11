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

## 4. Project specifics (fill in for each project)
- **Expert roles:** <e.g. web developer, data analyst>
- **Commands:**
  ```bash
  # test:  <command>
  # build: <command>
  # run:   <command>
  ```
- **Working branch:** <branch>
- **Environment facts:** <what the container can or can't reach, where builds run>
- **Conventions:** <code style, where logic lives, testing rule>
