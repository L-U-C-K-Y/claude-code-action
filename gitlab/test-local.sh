#!/bin/bash
# Local testing script for Claude GitLab integration

echo "🧪 Testing Claude GitLab Integration Locally"

# Set up test environment variables
export CI_PROJECT_ID="123"
export CI_PROJECT_PATH="test/project"
export CI_PROJECT_URL="https://gitlab.com/test/project"
export CI_MERGE_REQUEST_IID="42"
export CI_MERGE_REQUEST_SOURCE_BRANCH_NAME="feature/test"
export CI_MERGE_REQUEST_TARGET_BRANCH_NAME="main"
export GITLAB_USER_LOGIN="testuser"
export CI_JOB_ID="999"
export CI_JOB_URL="https://gitlab.com/test/project/-/jobs/999"
export CI_PIPELINE_ID="888"
export CI_PIPELINE_URL="https://gitlab.com/test/project/-/pipelines/888"
export CI_API_V4_URL="https://gitlab.com/api/v4"
export CI_DEFAULT_BRANCH="main"

# You need to set these:
echo "⚠️  Make sure to set these environment variables:"
echo "  - CLAUDE_BOT_TOKEN or GITLAB_TOKEN (your GitLab PAT)"
echo "  - ANTHROPIC_API_KEY (your Anthropic API key)"
echo ""

# Run the tests
echo "Running unit tests..."
cd /Users/lucky/Development/GitHub/anthropics/claude-code-action/gitlab
bun test

echo ""
echo "Testing context parsing..."
bun run src/main.ts --dry-run 2>&1 | head -20

echo ""
echo "✅ Basic tests complete!"