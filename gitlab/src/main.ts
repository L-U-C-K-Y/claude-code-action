#!/usr/bin/env bun

/**
 * Claude Code GitLab Integration
 * Main entry point
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseGitLabContext } from './context';
import { GitLabAPI } from './api';
import { 
  formatGitLabDataForPrompt, 
  createInitialCommentBody, 
  createUpdateSection 
} from './formatter';
import type { GitLabNote } from './types';
import { prepareMcpConfig } from './install-mcp-server';

// Import from upstream base-action (copied locally)
import { validateEnvironmentVariables } from './upstream/validate-env';
import { runClaude } from './upstream/run-claude';

// Define allowed tools for Claude
const BASE_ALLOWED_TOOLS = [
  'Edit',
  'MultiEdit',
  'Glob',
  'Grep',
  'LS',
  'Read',
  'Write',
  'Bash',
  'TodoWrite',
  'mcp__gitlab_comment__update_claude_comment'  // MCP tool for updating comments
];

const DISALLOWED_TOOLS = [
  'WebSearch',
  'WebFetch'
];

async function main() {
  console.log('🤖 Claude GitLab Integration Starting...');
  
  let context: ReturnType<typeof parseGitLabContext> | undefined;
  let api: GitLabAPI | undefined;
  let trackingComment: GitLabNote | undefined;
  let startTime: number | undefined;
  let durationStr = '';

  try {
    // Parse GitLab context
    context = parseGitLabContext();
    console.log(`Context: ${context.isMR ? 'MR' : 'Issue'} #${context.iid} in project ${context.projectPath}`);

    // Initialize API
    api = new GitLabAPI(context.token, context.apiUrl, context.projectId);

    // Check if we should run
    const triggerCheck = await api.checkTrigger(context);

    // Log context
    console.log('Parsed context:', JSON.stringify(context, null, 2));
    
    if (!triggerCheck.shouldRun) {
      console.log(`No trigger found: ${triggerCheck.reason}`);
      process.exit(0);
    }
    console.log(`Trigger found: ${triggerCheck.reason} (${triggerCheck.triggerType})`);

    // Create initial tracking comment
    // If we have trigger comments, reply to the first one
    if (triggerCheck.triggerComments.length > 0 && triggerCheck.triggerType === 'comment') {
      const firstTrigger = triggerCheck.triggerComments[0];
      console.log(`Creating reply to trigger comment in discussion ${firstTrigger.discussionId}`);
      console.log(`  Trigger note ID: ${firstTrigger.note.id}`);
      console.log(`  Has existing Claude reply: ${firstTrigger.hasClaudeReply}`);
      
      trackingComment = await api.createReply({
        projectId: context.projectId,
        isMR: context.isMR,
        iid: context.iid,
        discussionId: firstTrigger.discussionId,
        noteId: firstTrigger.note.id,
        body: createInitialCommentBody(context)
      });
      console.log(`Created tracking reply in discussion ${firstTrigger.discussionId}: ${trackingComment.id}`);
    } else {
      // Fall back to creating a new comment if no trigger comments
      console.log('Creating new comment (no trigger comments found)');
      trackingComment = await api.createComment({
        projectId: context.projectId,
        isMR: context.isMR,
        iid: context.iid,
        body: createInitialCommentBody(context)
      });
      console.log(`Created tracking comment: ${trackingComment.id}`);
    }

    // Fetch all relevant data
    console.log('Fetching GitLab data...');
    const data = await api.fetchData(context);
    
    if (data.categorizedComments) {
      console.log('Categorized comments:');
      console.log(`  - Trigger comments: ${data.categorizedComments.triggerComments.length}`);
      console.log(`  - Context comments: ${data.categorizedComments.contextComments.length}`);
      console.log(`  - Resolved comments: ${data.categorizedComments.resolvedComments.length}`);
      console.log(`  - Claude replies: ${data.categorizedComments.claudeReplies.length}`);
    }
    
    // Setup git configuration
    console.log('Configuring git...');
    execSync(`git config --global user.email "claude-bot@${new URL(context.apiUrl).hostname}"`);
    execSync('git config --global user.name "Claude Bot"');

    // Checkout the appropriate branch
    const currentBranch = context.isMR ? (context.sourceBranch || context.defaultBranch) : context.defaultBranch;
    console.log(`Checking out branch: ${currentBranch}`);
    execSync(`git checkout ${currentBranch}`);

    // Prepare prompt for Claude
    console.log('Preparing prompt for Claude...');
    const promptContent = formatGitLabDataForPrompt(data, context);
    
    // Create a temporary directory for Claude
    const tempDir = process.env.RUNNER_TEMP || '/tmp';
    const claudeDir = join(tempDir, 'claude-prompts');
    mkdirSync(claudeDir, { recursive: true });
    
    const promptFile = join(claudeDir, 'prompt.txt');
    writeFileSync(promptFile, promptContent);

    // Log prompt file
    console.log('Prompt content:', promptContent);

    // Validate environment for Claude
    try {
      validateEnvironmentVariables();
    } catch (error) {
      throw new Error(`Environment validation failed: ${error}`);
    }

    // Set environment variables for Claude execution
    process.env.CLAUDE_COMMENT_ID = trackingComment.id.toString();
    process.env.GITLAB_PROJECT_ID = context.projectId;
    process.env.GITLAB_TOKEN = context.token;
    process.env.GITLAB_API_URL = context.apiUrl;
    process.env.GITLAB_IS_MR = context.isMR ? 'true' : 'false';
    process.env.GITLAB_IID = context.iid.toString();
    
    // Prepare MCP configuration
    console.log('Setting up MCP servers...');
    const mcpConfigJson = prepareMcpConfig(context, trackingComment.id.toString());
    
    // Prepare allowed tools based on environment variables
    const allowedTools = process.env.CLAUDE_ALLOWED_TOOLS 
      ? process.env.CLAUDE_ALLOWED_TOOLS.split(',').map(t => t.trim())
      : BASE_ALLOWED_TOOLS;
    
    const disallowedTools = process.env.CLAUDE_DISALLOWED_TOOLS
      ? process.env.CLAUDE_DISALLOWED_TOOLS.split(',').map(t => t.trim())
      : DISALLOWED_TOOLS;
    
    // Prepare system prompt enforcement for git workflow
    const appendSystemPrompt = `
CRITICAL GIT WORKFLOW REQUIREMENTS - These are mandatory and cannot be bypassed:

1. BRANCH CREATION:
   - You MUST create a new branch for ANY code changes - NO EXCEPTIONS
   - ALWAYS run 'git branch --show-current' first before any commits
   - Never commit directly to ANY existing branch (including feature branches)
   - Even if you're already on a feature branch (e.g., feature/xyz), create a NEW branch
   - For issues: Branch naming: <type>/issue-<number>-<description> (e.g., fix/issue-123-memory-leak)
   - For MRs: Branch naming: <type>/mr-<number>-<description> (e.g., fix/mr-456-null-pointer)
   - Common types: fix, feat, docs, chore, refactor, test, perf
   - IMPORTANT: Being on a non-default branch does NOT exempt you from creating a new branch

2. COMMIT MESSAGES:
   - Use conventional commit format: <type>(<scope>): <description>
   - Examples: "fix(api): resolve null pointer exception", "feat(auth): add OAuth2 integration"
   - Include issue/MR reference: "fixes #123" or "relates to !456"
   - Add co-author when working on behalf of someone: "Co-authored-by: Name <email>"

3. WORKFLOW:
   - Create branch → Make changes → Commit with descriptive message → Push to remote
   - Always include a merge request URL in your final comment
   - Format: [Create MR](${context.webUrl}/-/merge_requests/new?merge_request[source_branch]=<branch>&merge_request[target_branch]=<target>)

4. COMMUNICATION:
   - Use ONLY mcp__gitlab_comment__update_claude_comment tool for all updates
   - Never use file writes or other methods to communicate progress
`;

    // Run Claude
    console.log('Running Claude Code...');
    console.log(`  Model: ${process.env.CLAUDE_MODEL || 'default'}`);
    console.log(`  Max turns: ${process.env.CLAUDE_MAX_TURNS || 'default'}`);
    console.log(`  Timeout: ${process.env.CLAUDE_TIMEOUT_MINUTES || '30'} minutes`);
    console.log(`  Allowed tools: ${allowedTools.join(', ')}`);
    console.log(`  Disallowed tools: ${disallowedTools.join(', ')}`);
    console.log('\nSystem Prompt Append:');
    console.log('---');
    console.log(appendSystemPrompt.trim());
    console.log('---\n');
    startTime = Date.now();
    try {
      await runClaude(promptFile, {
        model: process.env.CLAUDE_MODEL,
        maxTurns: process.env.CLAUDE_MAX_TURNS,
        timeoutMinutes: process.env.CLAUDE_TIMEOUT_MINUTES || '30',
        allowedTools: allowedTools.join(','),
        disallowedTools: disallowedTools.join(','),
        mcpConfig: mcpConfigJson,
        appendSystemPrompt: appendSystemPrompt.trim()
      });
    } finally {
      // Cleanup if needed
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    durationStr = duration > 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`;

    // Update comment with completion status
    if (trackingComment) {
      await api.updateComment({
        projectId: context.projectId,
        isMR: context.isMR,
        iid: context.iid,
        noteId: trackingComment.id,
        body: createUpdateSection(
          'success',
          'Task completed successfully.',
          context,
          durationStr
        )
      });
    }

    console.log('✅ Claude GitLab Integration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    
    // Calculate duration if we have a start time
    if (startTime) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      durationStr = duration > 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`;
    }
    
    // Try to update the comment with error information
    if (trackingComment && api && context) {
      try {
        await api.updateComment({
          projectId: context.projectId,
          isMR: context.isMR,
          iid: context.iid,
          noteId: trackingComment.id,
          body: createUpdateSection(
            'error',
            error instanceof Error ? error.message : String(error),
            context,
            durationStr
          )
        });
      } catch (updateError) {
        console.error('Failed to update comment with error:', updateError);
      }
    }
    
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}