#!/usr/bin/env bun

/**
 * Claude Code GitLab Integration
 * Main entry point
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseGitLabContext, getClaudeBranchName } from './context';
import { GitLabAPI } from './api';
import { 
  formatGitLabDataForPrompt, 
  createInitialCommentBody, 
  createErrorCommentBody, 
  createSuccessCommentBody 
} from './formatter';
import type { GitLabNote } from './types';

// Import from upstream base-action (copied locally)
import { validateEnvironmentVariables } from './upstream/validate-env';
import { runClaude } from './upstream/run-claude';

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

    // Handle branch setup
    const branchName = getClaudeBranchName(context);
    if (!context.isMR) {
      // For issues, create a new branch
      console.log(`Creating new branch: ${branchName}`);
      
      // Check if branch already exists
      const branchExists = await api.branchExists(branchName);
      if (!branchExists) {
        await api.createBranch(branchName, context.defaultBranch);
      }
      
      // Fetch and checkout the branch
      execSync(`git fetch origin ${branchName}:${branchName}`);
      execSync(`git checkout ${branchName}`);
    } else {
      // For MRs, use the source branch
      console.log(`Using existing branch: ${branchName}`);
      execSync(`git checkout ${branchName}`);
    }

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
    
    // Start comment watcher in background
    const watcherPath = join(__dirname, 'comment-watcher.ts');
    console.log(`Starting comment watcher from: ${watcherPath}`);
    const watcher = execSync(`nohup bun ${watcherPath} > /tmp/comment-watcher.log 2>&1 & echo $!`).toString().trim();
    console.log(`Started comment watcher (PID: ${watcher})`);
    console.log('Comment update file will be monitored at: /tmp/gitlab-comment-update.md');
    
    // Run Claude
    console.log('Running Claude Code...');
    console.log(`  Model: ${process.env.CLAUDE_MODEL || 'default'}`);
    console.log(`  Max turns: ${process.env.CLAUDE_MAX_TURNS || 'default'}`);
    console.log(`  Timeout: ${process.env.CLAUDE_TIMEOUT_MINUTES || '30'} minutes`);
    startTime = Date.now();
    try {
      const claudeResult = await runClaude(promptFile, {
        model: process.env.CLAUDE_MODEL,
        maxTurns: process.env.CLAUDE_MAX_TURNS,
        timeoutMinutes: process.env.CLAUDE_TIMEOUT_MINUTES || '30'
      });
    } finally {
      // Stop the comment watcher
      try {
        execSync(`kill ${watcher}`);
      } catch (e) {
        // Ignore errors if process already stopped
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    durationStr = duration > 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`;

    // Check if any changes were made
    const gitStatus = execSync('git status --porcelain').toString().trim();
    const hasChanges = gitStatus.length > 0;

    if (hasChanges) {
      // Commit and push changes
      console.log('Committing changes...');
      execSync('git add -A');
      
      const commitMessage = `Apply Claude suggestions for ${context.isMR ? 'MR' : 'Issue'} #${context.iid}

Co-authored-by: Claude <claude-bot@anthropic.com>`;
      
      execSync(`git commit -m "${commitMessage}"`);
      execSync(`git push origin ${branchName}`);

      // For issues, create an MR
      if (!context.isMR) {
        console.log('Creating merge request...');
        const mr = await api.createMergeRequest(
          branchName,
          context.defaultBranch,
          `Claude: Fix for issue #${context.iid}`,
          `This MR addresses issue #${context.iid}\n\nGenerated by Claude based on the discussion in the issue.`
        );
        
        // Update comment with success and MR link
        if (trackingComment) {
          await api.updateComment({
            projectId: context.projectId,
            isMR: context.isMR,
            iid: context.iid,
            noteId: trackingComment.id,
            body: createSuccessCommentBody(
              'I\'ve analyzed the issue and created a merge request with the proposed changes.',
              context,
              branchName,
              mr.web_url,
              durationStr
            )
          });
        }
      } else {
        // Update comment with success
        if (trackingComment) {
          await api.updateComment({
            projectId: context.projectId,
            isMR: context.isMR,
            iid: context.iid,
            noteId: trackingComment.id,
            body: createSuccessCommentBody(
              'I\'ve pushed updates to this merge request based on the feedback.',
              context,
              branchName,
              undefined,
              durationStr
            )
          });
        }
      }
    } else {
      // No changes made
      if (trackingComment) {
        await api.updateComment({
          projectId: context.projectId,
          isMR: context.isMR,
          iid: context.iid,
          noteId: trackingComment.id,
          body: createSuccessCommentBody(
            'I\'ve analyzed the request. No code changes were needed, but I hope my analysis was helpful!',
            context,
            undefined,
            undefined,
            durationStr
          )
        });
      }
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
          body: createErrorCommentBody(
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