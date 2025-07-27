/**
 * Parse GitLab CI/CD environment variables to create context
 */

import type { GitLabContext } from './types';

export function parseGitLabContext(): GitLabContext {
  // Determine if this is an MR or Issue
  const isMR = !!process.env.CI_MERGE_REQUEST_IID;
  const iid = parseInt(
    isMR 
      ? process.env.CI_MERGE_REQUEST_IID! 
      : process.env.CI_ISSUE_IID || '0'
  );

  // Get authentication token
  const token = process.env.GITLAB_TOKEN || 
                process.env.CLAUDE_BOT_TOKEN || 
                process.env.CI_JOB_TOKEN || '';

  if (!token) {
    throw new Error('No GitLab token found. Please set CLAUDE_BOT_TOKEN or GITLAB_TOKEN in CI/CD variables.');
  }

  // Build context object
  const context: GitLabContext = {
    // Project information
    projectId: process.env.CI_PROJECT_ID || '',
    projectPath: process.env.CI_PROJECT_PATH || '',
    projectUrl: process.env.CI_PROJECT_URL || '',
    webUrl: process.env.CI_PROJECT_URL || '',
    
    // MR/Issue context
    isMR,
    iid,
    
    // User and trigger info
    triggerUser: process.env.GITLAB_USER_LOGIN || process.env.CI_COMMIT_AUTHOR || '',
    triggerUsername: process.env.GITLAB_USER_LOGIN || process.env.CI_COMMIT_AUTHOR || '', // alias
    triggerPhrase: process.env.CLAUDE_TRIGGER_PHRASE || '@claude',
    
    // Branch information
    defaultBranch: process.env.CI_DEFAULT_BRANCH || 'main',
    sourceBranch: process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME,
    targetBranch: process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME,
    
    // CI/CD context
    jobId: process.env.CI_JOB_ID || '',
    jobUrl: process.env.CI_JOB_URL || '',
    pipelineId: process.env.CI_PIPELINE_ID || '',
    pipelineUrl: process.env.CI_PIPELINE_URL || '',
    
    // Authentication
    token,
    apiUrl: process.env.CI_API_V4_URL || 'https://gitlab.com/api/v4'
  };

  // Validate required fields
  if (!context.projectId) {
    throw new Error('CI_PROJECT_ID environment variable is required');
  }

  if (!context.iid && context.iid !== 0) {
    throw new Error('No MR or Issue IID found. Ensure CI_MERGE_REQUEST_IID or CI_ISSUE_IID is set.');
  }

  return context;
}

export function getClaudeBranchName(context: GitLabContext): string {
  if (context.isMR && context.sourceBranch) {
    // For MRs, use the existing source branch
    return context.sourceBranch;
  } else {
    // For issues, create a new branch name
    const prefix = process.env.CLAUDE_BRANCH_PREFIX || 'claude/';
    const timestamp = Date.now();
    return `${prefix}issue-${context.iid}-${timestamp}`;
  }
}

export function formatJobUrl(context: GitLabContext): string {
  return context.jobUrl || `${context.pipelineUrl}/-/jobs/${context.jobId}`;
}

export function isValidTrigger(text: string, context: GitLabContext): boolean {
  return text.toLowerCase().includes(context.triggerPhrase.toLowerCase());
}