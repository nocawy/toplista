# Agent Instructions

## Commit Messages

When generating commit messages:
- Use Conventional Commits: `<type>(<scope>): <subject>`.
- Keep scope short: e.g., front, back, api, ui.
- Subject: imperative mood, <= 72 chars, no trailing period.
- Body: 1-3 concise bullets when useful; explain why when the rationale is known.
- If the rationale is obvious from the subject or unknown, omit the body.
- After completing code changes, suggest a concise commit message unless a commit was already created.

Commit types commonly used in this repo:
- `feat`: new user-facing functionality
- `fix`: bug fixes
- `refactor`: code changes without behavior change
- `docs`: documentation only
- `test`: add or update tests
- `chore`: tooling, config, dependencies, maintenance
