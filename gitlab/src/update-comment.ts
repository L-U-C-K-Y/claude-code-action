#!/usr/bin/env bun

/**
 * GitLab Comment Update Script
 * Called by Claude during execution to update progress
 */

import { GitLabAPI } from './api';

async function updateComment() {
  // Get environment variables
  const commentId = process.env.CLAUDE_COMMENT_ID;
  const projectId = process.env.GITLAB_PROJECT_ID;
  const token = process.env.GITLAB_TOKEN;
  const apiUrl = process.env.GITLAB_API_URL;
  const isMR = process.env.GITLAB_IS_MR === 'true';
  const iid = parseInt(process.env.GITLAB_IID || '0');
  
  // Get the new comment body from stdin or argument
  const body = process.argv[2] || '';
  
  if (!commentId || !projectId || !token || !apiUrl || !body) {
    console.error('Missing required environment variables or body');
    process.exit(1);
  }
  
  try {
    const api = new GitLabAPI(token, apiUrl, projectId);
    
    await api.updateComment({
      projectId,
      isMR,
      iid,
      noteId: parseInt(commentId),
      body
    });
    
    console.log('Comment updated successfully');
  } catch (error) {
    console.error('Failed to update comment:', error);
    process.exit(1);
  }
}

updateComment();