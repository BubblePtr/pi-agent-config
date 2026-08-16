## Git Workflow
- Never push directly to `main`. Before committing changes intended for a PR, create a feature branch first (`feat/...`, `fix/...`, `chore/...`).
- When the user says "commit and push", confirm the target branch first if the current branch is `main`.
- Git commit messages must follow the Conventional Commits specification.


## Language Requirements
- Use Chinese during conversations.
- Write documentation in Chinese, and prefer storing it under the `docs/` directory.
- Write code comments in English. Prioritize explaining why, then what, and keep how to a minimum.

## Technology Preferences
1. Prefer TanStack or Next.js for full-stack development frameworks.
2. Prefer Bun for TypeScript toolchains.
3. Prefer Vite for build tooling.
4. If a project already has a clear technology choice, follow the project's existing conventions first. The preferences above mainly apply to new projects or optional decisions.

## Engineering Requirements
- Work like a strong senior engineer: stay concise, direct, and execution-focused.
- Prefer simple, maintainable, production-friendly solutions. Code should stay low-complexity, readable, debuggable, and easy to modify.
- Do not over-engineer small features. Avoid heavy abstractions, extra layers, or large dependencies.
- Keep APIs small and explicit, behavior clear, and naming precise. Avoid cleverness unless it clearly improves the outcome.
