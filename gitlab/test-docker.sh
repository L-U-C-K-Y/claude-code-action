#!/bin/bash
# Test GitLab integration in Docker (simulating CI environment)

echo "🐳 Testing Claude GitLab in Docker (simulating GitLab CI)"

# Build a test image
cat > Dockerfile.test << 'EOF'
FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y git curl unzip

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Copy the GitLab integration
WORKDIR /app
COPY . .

# Install dependencies
WORKDIR /app/gitlab
RUN bun install

# Set up test environment
ENV CI_PROJECT_ID="123"
ENV CI_PROJECT_PATH="test/project"
ENV CI_PROJECT_URL="https://gitlab.com/test/project"
ENV CI_MERGE_REQUEST_IID="42"
ENV CI_MERGE_REQUEST_SOURCE_BRANCH_NAME="feature/test"
ENV CI_MERGE_REQUEST_TARGET_BRANCH_NAME="main"
ENV GITLAB_USER_LOGIN="testuser"
ENV CI_JOB_ID="999"
ENV CI_JOB_URL="https://gitlab.com/test/project/-/jobs/999"
ENV CI_PIPELINE_ID="888"
ENV CI_PIPELINE_URL="https://gitlab.com/test/project/-/pipelines/888"
ENV CI_API_V4_URL="https://gitlab.com/api/v4"
ENV CI_DEFAULT_BRANCH="main"

# Run tests
CMD ["bun", "run", "src/test-runner.ts"]
EOF

# Build and run
docker build -f Dockerfile.test -t claude-gitlab-test .
docker run --rm \
  -e GITLAB_TOKEN="${GITLAB_TOKEN}" \
  -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  claude-gitlab-test

# Clean up
rm Dockerfile.test