#!/usr/bin/env bun

/**
 * Watch for comment updates from Claude
 */

import { watch } from 'fs';
import { readFile } from 'fs/promises';
import { GitLabAPI } from './api';

const UPDATE_FILE = '/tmp/gitlab-comment-update.md';
const CHECK_INTERVAL = 2000; // Check every 2 seconds

async function watchForUpdates() {
  const commentId = process.env.CLAUDE_COMMENT_ID;
  const projectId = process.env.GITLAB_PROJECT_ID;
  const token = process.env.GITLAB_TOKEN;
  const apiUrl = process.env.GITLAB_API_URL;
  const isMR = process.env.GITLAB_IS_MR === 'true';
  const iid = parseInt(process.env.GITLAB_IID || '0');
  
  if (!commentId || !projectId || !token || !apiUrl) {
    console.error('Missing required environment variables');
    process.exit(1);
  }
  
  const api = new GitLabAPI(token, apiUrl, projectId);
  let lastContent = '';
  
  console.log(`Watching for updates to ${UPDATE_FILE}...`);
  
  // Check for updates periodically
  setInterval(async () => {
    try {
      const content = await readFile(UPDATE_FILE, 'utf-8');
      
      // Only update if content has changed
      if (content && content !== lastContent) {
        console.log('Detected comment update, syncing to GitLab...');
        
        await api.updateComment({
          projectId,
          isMR,
          iid,
          noteId: parseInt(commentId),
          body: content
        });
        
        lastContent = content;
        console.log('Comment updated successfully');
      }
    } catch (error) {
      // File doesn't exist yet, that's okay
      if ((error as any).code !== 'ENOENT') {
        console.error('Error checking for updates:', error);
      }
    }
  }, CHECK_INTERVAL);
}

// Start watching
watchForUpdates();

// Keep the process alive
process.on('SIGINT', () => {
  console.log('Stopping comment watcher...');
  process.exit(0);
});