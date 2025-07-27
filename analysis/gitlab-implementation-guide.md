# GitLab Claude Code Implementation Guide

## Overview

This guide covers adapting Claude Code for GitLab using a clean fork approach with separate directories.

**Timeline**: 6-8 weeks  
**Approach**: Separate `gitlab/` directory in fork, no file conflicts with upstream

## Fork Structure

```
claude-code-action/ (your fork)
├── [all original files - never modified]
├── gitlab/                    # All GitLab code here
│   ├── .gitlab-ci.yml        # Main CI config
│   ├── package.json          # GitLab dependencies
│   ├── tsconfig.json         # TypeScript config
│   ├── README.md             # GitLab-specific docs
│   ├── src/
│   │   ├── main.ts           # Entry point
│   │   ├── api.ts            # GitLab API wrapper
│   │   ├── context.ts        # Parse CI environment
│   │   └── types.ts          # GitLab types
│   ├── templates/            # User CI templates
│   │   └── claude-code.yml
│   └── examples/             # Example configs
└── .github/workflows/
    └── sync-upstream.yml     # Auto-sync from upstream
```

## Implementation Plan

### Phase 1: Fork Setup (Week 1)

#### Step 1: Create Fork Structure
```bash
# Fork on GitHub
git clone https://github.com/YOUR_USERNAME/claude-code-action.git
cd claude-code-action

# Add upstream
git remote add upstream https://github.com/anthropics/claude-code-action.git

# Create GitLab directory
mkdir -p gitlab/{src,templates,examples}
cd gitlab
```

#### Step 2: Initialize GitLab Package
```json
// gitlab/package.json
{
  "name": "claude-code-gitlab",
  "version": "1.0.0",
  "description": "Claude Code for GitLab",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/main.ts",
    "test": "jest"
  },
  "dependencies": {
    "@gitbeaker/node": "^39.0.0",
    "@modelcontextprotocol/sdk": "^0.6.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  }
}
```

#### Step 3: TypeScript Configuration
```json
// gitlab/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@upstream/*": ["../*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Phase 2: Core Implementation (Weeks 2-3)

#### Step 4: GitLab Types
```typescript
// gitlab/src/types.ts
export interface GitLabContext {
  projectId: string;
  projectPath: string;
  isMR: boolean;
  iid: number;
  triggerUser: string;
  defaultBranch: string;
  sourceBranch?: string;
  jobUrl: string;
  token: string;
}

export interface GitLabMR {
  iid: number;
  title: string;
  description: string;
  source_branch: string;
  target_branch: string;
  author: {
    username: string;
    name: string;
  };
}
```

#### Step 5: Context Parser
```typescript
// gitlab/src/context.ts
import type { GitLabContext } from './types';

export function parseGitLabContext(): GitLabContext {
  const isMR = !!process.env.CI_MERGE_REQUEST_IID;
  
  return {
    projectId: process.env.CI_PROJECT_ID!,
    projectPath: process.env.CI_PROJECT_PATH!,
    isMR,
    iid: parseInt(isMR ? process.env.CI_MERGE_REQUEST_IID! : process.env.CI_ISSUE_IID || '0'),
    triggerUser: process.env.GITLAB_USER_LOGIN!,
    defaultBranch: process.env.CI_DEFAULT_BRANCH || 'main',
    sourceBranch: process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME,
    jobUrl: `${process.env.CI_PIPELINE_URL}/-/jobs/${process.env.CI_JOB_ID}`,
    token: process.env.GITLAB_TOKEN || process.env.CLAUDE_BOT_TOKEN!
  };
}
```

#### Step 6: Main Entry Point
```typescript
// gitlab/src/main.ts
import { Gitlab } from '@gitbeaker/node';
import { parseGitLabContext } from './context';

// Import from upstream
import { runClaude } from '../../base-action/src/run-claude';
import { preparePrompt } from '../../base-action/src/prepare-prompt';
import { createPrompt } from '../../src/create-prompt';

async function main() {
  console.log('🤖 Claude GitLab Integration Starting...');
  
  // Parse context
  const context = parseGitLabContext();
  
  // Initialize GitLab API
  const gitlab = new Gitlab({
    token: context.token,
    host: process.env.CI_API_V4_URL
  });
  
  // Check trigger
  const shouldRun = await checkTrigger(gitlab, context);
  if (!shouldRun) {
    console.log('No Claude trigger found');
    process.exit(0);
  }
  
  // Create tracking comment
  const comment = await createComment(gitlab, context, '🤖 Claude is thinking...');
  
  // Get MR/Issue data
  const data = await fetchData(gitlab, context);
  
  // Prepare prompt using upstream components
  const promptFile = await preparePrompt({
    content: formatGitLabData(data),
    customInstructions: process.env.CUSTOM_INSTRUCTIONS
  });
  
  // Run Claude using upstream
  await runClaude({
    promptFile,
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229'
  });
  
  // Update comment
  await updateComment(gitlab, context, comment.id, '✅ Complete!');
}

main().catch(console.error);
```

### Phase 3: CI/CD Integration (Weeks 4-5)

#### Step 7: User Template
```yaml
# gitlab/templates/claude-code.yml
variables:
  CLAUDE_IMAGE: "node:20"
  CLAUDE_TRIGGER: "@claude"

.claude-base:
  image: $CLAUDE_IMAGE
  before_script:
    # Install from npm or use local build
    - npm install -g claude-code-gitlab
    # OR for development:
    # - cd gitlab && npm install && npm run build
  variables:
    GITLAB_TOKEN: $CLAUDE_BOT_TOKEN
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY

# MR comment trigger
claude-mr:
  extends: .claude-base
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  script:
    - claude-code-gitlab

# Issue trigger  
claude-issue:
  extends: .claude-base
  rules:
    - if: '$CI_COMMIT_MESSAGE =~ /\@claude/'
      when: always
  script:
    - claude-code-gitlab
```

#### Step 8: Example Configuration
```yaml
# gitlab/examples/basic.gitlab-ci.yml
include:
  # From your fork
  - remote: 'https://raw.githubusercontent.com/YOUR_USER/claude-code-action/main/gitlab/templates/claude-code.yml'
  
  # Or from published package
  # - remote: 'https://unpkg.com/claude-code-gitlab/templates/claude-code.yml'

variables:
  CLAUDE_BOT_TOKEN: $CLAUDE_BOT_TOKEN
  ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
```

### Phase 4: Testing & Polish (Weeks 6-8)

#### Step 9: Upstream Sync Workflow
```yaml
# .github/workflows/sync-upstream.yml
name: Sync with upstream
on:
  schedule:
    - cron: '0 0 * * 0' # Weekly
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Sync upstream
        run: |
          git remote add upstream https://github.com/anthropics/claude-code-action.git || true
          git fetch upstream
          git checkout main
          git merge upstream/main --no-edit --allow-unrelated-histories || {
            echo "Merge conflict in main files, but gitlab/ is safe"
            git status
          }
          git push origin main
```

#### Step 10: Build & Publish
```bash
# Build
cd gitlab
npm install
npm run build

# Test locally
GITLAB_TOKEN=xxx ANTHROPIC_API_KEY=xxx npm run dev

# Publish to npm
npm publish

# Users can then use:
# npx claude-code-gitlab
```

## Quick Start for Users

1. **Create GitLab Bot User**
   - Create user "claude-bot"
   - Generate Personal Access Token with `api`, `write_repository` scopes

2. **Add CI/CD Variables**
   - `CLAUDE_BOT_TOKEN`: Your PAT
   - `ANTHROPIC_API_KEY`: Your Anthropic key

3. **Add to `.gitlab-ci.yml`**
   ```yaml
   include:
     - remote: 'https://unpkg.com/claude-code-gitlab/templates/claude-code.yml'
   ```

## Implementation Checklist

### Week 1: Setup
- [ ] Fork repository
- [ ] Create `gitlab/` directory structure
- [ ] Set up package.json and tsconfig
- [ ] Configure upstream sync

### Weeks 2-3: Core
- [ ] Implement GitLab API wrapper
- [ ] Create context parser
- [ ] Build main entry point
- [ ] Import upstream components

### Weeks 4-5: Integration
- [ ] Create CI/CD templates
- [ ] Test with real GitLab
- [ ] Handle edge cases
- [ ] Write examples

### Weeks 6-8: Polish
- [ ] Documentation
- [ ] npm publishing setup
- [ ] Automated tests
- [ ] Performance optimization

## Benefits of This Approach

1. **Zero Merge Conflicts**: GitLab code is completely separate
2. **Easy Updates**: Pull upstream anytime without issues
3. **Reuse Components**: Import generic code from parent directories
4. **Clear Ownership**: All GitLab code in one place
5. **Independent Publishing**: Can publish gitlab/ as separate package

## Directory Import Examples

```typescript
// From gitlab/src/main.ts

// Import generic components from parent
import { runClaude } from '../../base-action/src/run-claude';
import { createPrompt } from '../../src/create-prompt';
import * as modes from '../../src/modes';

// Import GitLab-specific code
import { GitLabAPI } from './api';
import { parseContext } from './context';
```

This structure keeps your GitLab implementation clean and maintainable while leveraging all the generic Claude Code components!