# Git & GitHub Best Practices

## Core Principle

Maintain a clean, understandable, and reviewable Git history.

Prefer small, focused, logical commits over large commits containing unrelated changes.

## Granular Commits

Each commit should represent ONE logical change.

Good examples:

- Add product API endpoint
- Add product creation screen
- Add PostgreSQL products table
- Fix inventory quantity calculation
- Update product form validation
- Add loading state to product screen

Avoid combining unrelated changes:

Bad:

"Update product screen, fix authentication, modify database, update README"

Instead, separate them into logical commits.

## Before Committing

Always inspect the current Git state:

1. Check `git status`
2. Review changed files
3. Review the actual diff
4. Identify unrelated changes
5. Stage only the files belonging to the intended change
6. Review the staged diff
7. Commit

Prefer:

```bash
git diff
git diff --staged
git status
```

Over staging everything with `git add .`

## Branch Strategy

- `main` — production-ready code, stable releases only
- `develop` — integration branch for features (if using Git Flow)
- `feature/*` — new features (e.g., `feature/product-api`, `feature/login-screen`)
- `fix/*` — bug fixes (e.g., `fix/inventory-calculation`)
- `docs/*` — documentation updates

Always branch from `main` (or `develop`). Never commit directly to `main`.

## Commit Messages

Follow this format:

```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

### Type

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring (no behavior change)
- `docs:` — documentation
- `test:` — tests
- `chore:` — tooling, dependencies, build config
- `style:` — formatting, linting (no logic change)

### Subject

- Imperative mood ("add" not "added" or "adds")
- Do not capitalize the first letter
- No period at the end
- Under 50 characters

### Body

- Explain what and why, not how
- Use imperative mood
- Reference issue numbers if applicable (e.g., "Fixes #42")

### Examples

Good:

```
feat: add product creation endpoint

- POST /products endpoint validates input and creates product in database
- Returns created product with 201 status
- Validates required fields (name, supplier, price)

Fixes #15
```

```
fix: correct inventory deduction on order completion

Previously inventory was deducted on order creation instead of completion,
causing stock conflicts when orders were cancelled.

Now inventory is only deducted when order status changes to 'completed'.
```

## Pull Requests

1. **Keep scope small** — one feature or fix per PR
2. **Write a clear description**:
   - What does this change do?
   - Why is it needed?
   - What was tested?
3. **Reference issues** — "Fixes #123" in the description
4. **Request review** before merging
5. **Squash commits** if the branch has many small commits (optional, depends on team preference)
6. **Delete the branch** after merge

## Code Review Process

When reviewing:

- Check for logical correctness
- Verify tests pass
- Ensure naming is clear
- Look for edge cases
- Ask questions, don't demand changes

When receiving feedback:

- Address concerns with follow-up commits (don't force push)
- Ask for clarification if unclear
- Approve feedback by replying in the review thread

## Rewriting History

Avoid rewriting history on shared branches. Only do this:

- On your local feature branch before pushing
- With team agreement on shared branches
- Never on `main` or `develop`

Safe operations:

```bash
git commit --amend          # Fix last commit (unpushed)
git rebase -i HEAD~3        # Reorganize last 3 commits (unpushed)
```

Unsafe (destructive):

```bash
git reset --hard            # Discards work
git push --force            # Overwrites shared history
```

## Checking Before Push

Always verify before pushing:

```bash
git log origin/main..HEAD   # See what you're about to push
git diff origin/main        # See all changes
npm test                    # Run tests
npm run build               # Verify build succeeds
```

## Tagging Releases

Tag releases for easy reference:

```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

Use semantic versioning: `v<major>.<minor>.<patch>`
