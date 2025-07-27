# Upstream Files

This directory contains files copied from the `base-action/src/` directory to make the GitLab integration self-contained.

## Files

- `validate-env.ts` - Environment validation logic
- `run-claude.ts` - Claude execution logic
- `prepare-prompt.ts` - Prompt preparation
- `actions-core-shim.ts` - Shim for @actions/core (GitLab-specific)

## Modifications

Each file has been modified with:
1. Updated import paths (relative instead of external)
2. @actions/core replaced with actions-core-shim
3. RUNNER_TEMP environment variable falls back to /tmp

## Updating

To update these files with latest upstream changes:

```bash
# Copy latest files
./copy-upstream.sh

# Update imports automatically
./update-imports.sh

# Add tracking headers
./add-upstream-headers.sh
```

## Why Copy?

We copy these files instead of importing from parent directories because:
- Makes the gitlab/ directory self-contained
- Can be published as standalone npm package
- Easier to test without full fork structure
- Clear visibility of modifications