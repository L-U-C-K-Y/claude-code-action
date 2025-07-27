# Testing Claude GitLab Integration

## Before Publishing

### 1. Unit Tests
```bash
cd gitlab
bun install
bun test
```

### 2. Integration Test (No Real GitLab)
```bash
# Set test environment variables
export CI_PROJECT_ID="123"
export CI_PROJECT_PATH="test/project"
export CI_MERGE_REQUEST_IID="42"
# ... (see test-local.sh for full list)

# Run test runner
bun run src/test-runner.ts
```

### 3. Test with Real GitLab Project
```bash
# Set real GitLab credentials
export GITLAB_TOKEN="your-pat-token"
export CI_PROJECT_ID="your-real-project-id"
export CI_MERGE_REQUEST_IID="real-mr-number"

# Run test runner
bun run src/test-runner.ts
```

### 4. Local Installation Test
```bash
cd gitlab
bun install
bun link

# In another directory
bun link claude-code-gitlab
claude-code-gitlab

# Or test directly
bun run claude-code-gitlab
```

### 5. Docker Test (Simulates GitLab CI)
```bash
cd gitlab
./test-docker.sh
```

### 6. Manual GitLab CI Test

Create a test project on GitLab and add this `.gitlab-ci.yml`:

```yaml
test-claude-local:
  image: node:20-slim
  before_script:
    - apt-get update && apt-get install -y git curl unzip
    - curl -fsSL https://bun.sh/install | bash
    - export PATH="$HOME/.bun/bin:$PATH"
    - git clone $CI_REPOSITORY_URL /tmp/test-repo
    - cd /tmp/test-repo/gitlab
    - bun install
    - bun link
  script:
    - bun run claude-code-gitlab || echo "Expected to fail without real MR"
  variables:
    GITLAB_TOKEN: $CLAUDE_BOT_TOKEN
  rules:
    - when: manual
```

## Common Issues

### "No trigger found"
This is normal in test mode. The trigger check looks for recent comments with "@claude".

### "Cannot find upstream files"
Expected until this is in a proper fork structure. Use `test-runner.ts` instead.

### "No token found"
Set either `GITLAB_TOKEN` or `CLAUDE_BOT_TOKEN` environment variable.

## Test Checklist

- [ ] Context parsing works
- [ ] API connection succeeds (with valid token)
- [ ] Comment formatting is correct
- [ ] Branch name generation works
- [ ] Unit tests pass
- [ ] Docker test runs
- [ ] Can be installed locally with `bun link`