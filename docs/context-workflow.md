# Keeping context: what to ask Claude, and when

## What is automatic (you don't need to ask)
- **`CLAUDE.md`** loads at the start of every session.
- **A hook re-loads `PROJECT_CONTEXT.md`** (`.claude/settings.json`, SessionStart) at session start, on resume, after
  `/clear`, and **right after every automatic compaction**.
- **Claude updates `PROJECT_CONTEXT.md`** after each finished task or commit (rule in `CLAUDE.md`).

The prompts below are for when you want to force an update or check one.

## Timing at a glance
| When | Ask | File |
|---|---|---|
| Start of a session (optional check) | **"Where are we?"** | reads PROJECT_CONTEXT.md |
| After a task finishes | (automatic) or **"Save context."** | PROJECT_CONTEXT.md |
| About every hour of heavy work, or when Claude says the conversation is long | **"Checkpoint: update PROJECT_CONTEXT.md and commit."** | PROJECT_CONTEXT.md |
| Before you stop for the day | **"Wrap up: update PROJECT_CONTEXT.md with done / in progress / next, then commit."** | PROJECT_CONTEXT.md |
| After a new feature or a changed method | **"Update docs for <topic> and log the decision."** | docs/*.md + docs/decisions.md |
| When a rule or command changes | **"Add to CLAUDE.md: <rule>."** | CLAUDE.md |
| About once a month, or when files feel stale | **"Audit context: make PROJECT_CONTEXT.md, docs/ and CLAUDE.md match the code."** | all |

## Copy-paste prompts

**Save the current state (most used)**
> Save context: update PROJECT_CONTEXT.md (current session, done, in progress, next, open problems) and commit it.

**Before a long or risky task**
> Checkpoint first: write the plan for this task into PROJECT_CONTEXT.md "In progress", commit, then start.

**End of session**
> Wrap up: update PROJECT_CONTEXT.md with what we did today, what's unfinished and the exact next step, then commit.

**Record knowledge that should last**
> Update docs/<file>.md for <topic> and add a dated line to docs/decisions.md explaining why.

**Change how Claude works on this project**
> Add this rule to CLAUDE.md: <rule>. Keep CLAUDE.md short.

**New session after a break**
> Read PROJECT_CONTEXT.md and tell me where we are and what's next. Don't change anything yet.

**Answer-only mode**
> Just answer, don't update anything until I say okay.

## Rules that keep it working
1. **One context file only:** `PROJECT_CONTEXT.md` (about 150 lines max). Durable detail moves to `docs/`.
2. **Context holds the state; docs hold the knowledge.** If something will still be true in a month, it belongs in `docs/`.
3. **Commit context updates.** The cloud container is wiped after a session; only what's pushed to GitHub survives.
4. **This repo is the template.** On GitHub, click "Use this template" for each new project, then ask Claude:
   "Set up the context files for this project: fill in CLAUDE.md project specifics, PROJECT_CONTEXT.md and docs/architecture.md."
