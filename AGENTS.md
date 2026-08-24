# Agent Instructions

## Commit Structure

- Each commit should address one logical issue, feature, refactor, or maintenance task.
- Keep all parts required for that change - including tests and documentation - in the same commit.
- Order dependent commits so every commit leaves the project in a valid, understandable state.

## Commit Messages

When generating commit messages:
- Use Conventional Commits: `<type>[(scope)]: <subject>`.
- Scope is optional; include it only when it adds useful context.
- When used, keep scope short: e.g. `front`, `back`, `api`, `ui`, `ranking`.
- Subject: imperative mood, <= 72 chars, no trailing period.
- Body: concise but complete bullets for the important changes.
- Explain why when the rationale is known.
- Omit the body only for trivial changes where the subject fully explains the rationale.
- After completing code changes, suggest a commit message unless a commit was already created.

Commit types commonly used in this repo:
- `feat`: new user-facing functionality
- `fix`: bug fixes
- `refactor`: code changes without behavior change
- `docs`: documentation only
- `test`: add or update tests
- `chore`: tooling, config, dependencies, maintenance
