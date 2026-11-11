# Claude project template

Starter files that let Claude Code keep context across sessions and token limits.

| File | Role | Changes |
|---|---|---|
| `CLAUDE.md` | **How** to work: your rules plus the project's commands (auto-loaded every session) | Rarely |
| `PROJECT_CONTEXT.md` | **Where** the project stands: status, done, in progress, next | Constantly |
| `docs/` | **What** we know: architecture, methods, decision log, prompts | Sometimes |
| `.claude/settings.json` | Hook that re-loads `PROJECT_CONTEXT.md` at session start and after every compaction | Never |

## Start a new project
1. On GitHub: **Use this template → Create a new repository**.
2. Open it in Claude Code and say:
   > Set up the context files for this project: fill in CLAUDE.md project specifics, PROJECT_CONTEXT.md and docs/architecture.md.
3. Use the prompts in `docs/context-workflow.md`, e.g. "Save context." / "Wrap up." / "Where are we?"
