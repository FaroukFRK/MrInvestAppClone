# Decision log (newest last). Format: date: decision (reason)

- 2026-11-11: Context architecture: CLAUDE.md (how) + PROJECT_CONTEXT.md (now) + docs/ (knowledge) + SessionStart hook that re-injects PROJECT_CONTEXT.md at startup and after compaction.
- 2026-11-11: Build the "portfolio" app as an original, dependency-free PWA, not a pixel copy of mrinvestapp.com (their site was unreachable from the cloud container; also avoids copying another brand's look and name).
- 2026-11-11: Transactions are the single source of truth; average-cost basis (simplest, matches most broker summaries).
- 2026-11-11: No live price feed: manual prices (owner rule: no paid services or API keys without asking).
- 2026-11-11: Data stored in localStorage with JSON/CSV export (no backend, private by default, free hosting on GitHub Pages).
