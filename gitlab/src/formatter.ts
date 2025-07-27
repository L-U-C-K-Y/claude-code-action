/**
 * Format GitLab data for Claude Code prompt generation
 */

import type {
  GitLabContext,
  GitLabMergeRequest,
  GitLabIssue,
  GitLabDiff,
  FetchDataResult
} from './types';

export function formatGitLabDataForPrompt(
  data: FetchDataResult,
  context: GitLabContext
): string {
  const { context: entity, discussions, changes, commits } = data;
  
  let prompt = '## GitLab Integration Instructions\n\n';
  prompt += 'You are Claude Code running in a GitLab CI/CD pipeline.\n';
  prompt += 'You have been triggered to help with a GitLab issue or merge request.\n';
  prompt += 'You have access to read and modify files in the repository.\n\n';
  prompt += '**IMPORTANT**: All communication about your progress must be done using the `mcp__gitlab_comment__update_claude_comment` tool.\n';
  prompt += 'Do NOT attempt to write to files or use other methods to communicate. Use ONLY the MCP tool to update your comment.\n';
  prompt += 'This tool allows you to provide real-time updates about what you are doing.\n\n';
  prompt += 'Focus on addressing the specific questions and tasks mentioned in the comments below.\n\n';
  
  // Add Git workflow instructions
  prompt += '### Git Workflow Instructions\n\n';
  prompt += 'You have full control over git operations. Use the Bash tool to execute git commands.\n\n';
  
  prompt += '**IMPORTANT: Always create a new branch for your changes. Never commit directly to the default branch.**\n\n';
  
  prompt += '**For Issues:**\n';
  prompt += '- ALWAYS create a new branch with a descriptive name (e.g., `fix/issue-123-description`, `feat/issue-456-new-feature`)\n';
  prompt += '- Branch naming convention: `<type>/<issue-number>-<brief-description>`\n';
  prompt += '- Common types: `fix`, `feat`, `docs`, `chore`, `refactor`, `test`, `perf`\n';
  prompt += '- Never push changes without creating a feature branch first\n\n';
  
  prompt += '**For Merge Requests:**\n';
  prompt += '- ALWAYS create a new branch for any changes, even when reviewing MRs\n';
  prompt += '- Branch naming convention: `<type>/mr-<mr-number>-<brief-description>`\n';
  prompt += '- Example: `fix/mr-123-null-pointer` or `refactor/mr-456-improve-performance`\n';
  prompt += '- This ensures all changes are tracked and can be reviewed separately\n';
  prompt += '- Never commit directly to any existing branch\n\n';
  
  prompt += '**Commit Messages:**\n';
  prompt += '- Use conventional commit format: `<type>(<scope>): <description>`\n';
  prompt += '- Examples:\n';
  prompt += '  - `fix(api): resolve null pointer exception in user service`\n';
  prompt += '  - `feat(auth): add OAuth2 integration`\n';
  prompt += '  - `docs: update README with installation instructions`\n';
  prompt += '- Include issue/MR reference when relevant: `fixes #123` or `relates to !456`\n';
  prompt += '- Add co-author when working on behalf of someone: `Co-authored-by: Name <email>`\n\n';
  
  prompt += '**Git Commands Available:**\n';
  prompt += '- View current branch: `git branch --show-current`\n';
  prompt += '- Create and switch to new branch: `git checkout -b <branch-name>`\n';
  prompt += '- Stage files: `git add <files>` or `git add -A` for all changes\n';
  prompt += '- Commit with message: `git commit -m "<message>"`\n';
  prompt += '- Push to remote: `git push origin <branch-name>`\n';
  prompt += '- Check status: `git status`\n';
  prompt += '- View diff: `git diff`\n\n';
  
  prompt += '**Branch Safety Check:**\n';
  prompt += '- ALWAYS run `git branch --show-current` before making commits\n';
  prompt += '- If you are on `main`, `master`, or the default branch, create a new branch immediately\n';
  prompt += '- This ensures code changes go through proper review process\n\n';
  
  prompt += '**After Making Changes:**\n';
  prompt += '- Always create a merge request URL in your comment:\n';
  prompt += `  - Format: \`[Create MR](${context.webUrl}/-/merge_requests/new?merge_request[source_branch]=<branch-name>&merge_request[target_branch]=<target>)\`\n`;
  prompt += '  - Replace `<branch-name>` with your created branch\n';
  prompt += '  - For issues: `<target>` should be the default branch\n';
  prompt += '  - For MRs: `<target>` should be the MR\'s source branch\n';
  prompt += '- Always include a summary of changes in your final comment update\n';
  prompt += '- The new MR allows proper review of your specific changes\n\n';
  
  // Add response instructions based on categorized comments
  if (data.categorizedComments && data.categorizedComments.triggerComments.length > 0) {
    prompt += '### Your Task\n\n';
    prompt += 'You have been asked to respond to specific questions (see "Questions for Claude" section below).\n';
    prompt += 'Please address each question thoroughly, considering any context from unresolved discussions.\n';
    prompt += 'If you make code changes, follow the git workflow instructions above.\n\n';
  }
  
  prompt += '---\n\n';

  // Add entity information
  if (context.isMR) {
    const mr = entity as GitLabMergeRequest;
    prompt += `## Merge Request #${mr.iid}: ${mr.title}\n\n`;
    prompt += `**Author:** @${mr.author.username}\n`;
    prompt += `**Source Branch:** ${mr.source_branch}\n`;
    prompt += `**Target Branch:** ${mr.target_branch}\n`;
    prompt += `**State:** ${mr.state}\n`;
    prompt += `**URL:** ${mr.web_url}\n\n`;
    
    if (mr.description) {
      prompt += `### Description\n${mr.description}\n\n`;
    }

    // Add commit information
    if (commits && commits.length > 0) {
      prompt += `### Commits (${commits.length})\n`;
      commits.forEach(commit => {
        prompt += `- \`${commit.short_id}\` ${commit.title} by ${commit.author_name}\n`;
      });
      prompt += '\n';
    }

    // Add file changes summary
    if (changes && changes.length > 0) {
      prompt += `### Changed Files (${changes.length})\n`;
      changes.forEach(change => {
        const status = change.new_file ? 'added' : change.deleted_file ? 'deleted' : 'modified';
        prompt += `- ${change.new_path} (${status})\n`;
      });
      prompt += '\n';
    }
  } else {
    const issue = entity as GitLabIssue;
    prompt += `## Issue #${issue.iid}: ${issue.title}\n\n`;
    prompt += `**Author:** @${issue.author.username}\n`;
    prompt += `**State:** ${issue.state}\n`;
    prompt += `**Labels:** ${issue.labels.join(', ') || 'none'}\n`;
    prompt += `**URL:** ${issue.web_url}\n\n`;
    
    if (issue.description) {
      prompt += `### Description\n${issue.description}\n\n`;
    }
  }

  // Add categorized comments
  if (data.categorizedComments) {
    const { triggerComments, contextComments, claudeReplies } = data.categorizedComments;
    
    // Add trigger comments (questions for Claude)
    if (triggerComments.length > 0) {
      prompt += '\n### 🎯 Questions for Claude\n\n';
      prompt += '_These comments specifically requested Claude\'s attention:_\n\n';
      
      for (const comment of triggerComments) {
        const author = comment.author?.username || 'unknown';
        const date = new Date(comment.created_at).toLocaleString();
        const body = comment.body || '';
        
        prompt += `**@${author}** (${date}):\n${body}\n\n`;
      }
    }
    
    // Add context comments (unresolved discussions)
    if (contextComments.length > 0) {
      prompt += '\n### 💬 Discussion Context\n\n';
      prompt += '_These are unresolved comments that may be relevant:_\n\n';
      
      for (const comment of contextComments) {
        const author = comment.author?.username || 'unknown';
        const date = new Date(comment.created_at).toLocaleString();
        const body = comment.body || '';
        
        prompt += `**@${author}** (${date}):\n${body}\n\n`;
      }
    }
    
    // Add previous Claude replies for context
    if (claudeReplies.length > 0) {
      prompt += '\n### 🤖 Previous Claude Responses\n\n';
      prompt += '_Your previous responses in this discussion:_\n\n';
      
      for (const comment of claudeReplies) {
        const date = new Date(comment.created_at).toLocaleString();
        const body = comment.body || '';
        
        prompt += `**Claude** (${date}):\n${body}\n\n`;
      }
    }
  } else {
    // Fallback to showing all discussions if categorization is not available
    if (discussions && discussions.length > 0) {
      prompt += `### Discussion\n\n`;
      discussions.forEach(discussion => {
        discussion.notes.forEach(note => {
          if (!note.system) { // Skip system notes
            const timestamp = new Date(note.created_at).toLocaleString();
            prompt += `**@${note.author.username}** (${timestamp}):\n`;
            prompt += `${note.body}\n\n`;
          }
        });
      });
    }
  }

  // Add context about the current job
  prompt += `### CI/CD Context\n`;
  prompt += `- **Job:** [View logs](${context.jobUrl})\n`;
  prompt += `- **Pipeline:** ${context.pipelineId}\n`;
  prompt += `- **Triggered by:** @${context.triggerUser}\n`;
  prompt += `- **Current branch:** ${context.isMR ? (context.sourceBranch || context.defaultBranch) : context.defaultBranch}\n`;

  return prompt;
}

export function formatFileChangesForPrompt(changes: GitLabDiff[]): string {
  let output = '';
  
  changes.forEach(change => {
    output += `\n### File: ${change.new_path}\n`;
    
    if (change.new_file) {
      output += `**Status:** New file\n`;
    } else if (change.deleted_file) {
      output += `**Status:** Deleted\n`;
    } else if (change.renamed_file) {
      output += `**Status:** Renamed from ${change.old_path}\n`;
    } else {
      output += `**Status:** Modified\n`;
    }
    
    if (change.diff && !change.deleted_file) {
      output += '```diff\n';
      output += change.diff;
      output += '\n```\n';
    }
  });
  
  return output;
}

export function createInitialCommentBody(context: GitLabContext): string {
  const entityType = context.isMR ? 'merge request' : 'issue';
  
  return `Claude Code is working…

---

<details>
<summary>Task List</summary>

- [ ] Analyzing ${entityType} #${context.iid}
- [ ] Understanding the request from @${context.triggerUsername || 'user'}
- [ ] Preparing response
- [ ] Implementing changes (if needed)

</details>`;
}

export function createErrorCommentBody(error: string, context: GitLabContext, duration?: string): string {
  let header = '**Claude encountered an error';
  if (duration) {
    header += ` after ${duration}`;
  }
  header += '**';
  
  const links = ` —— [View job](${context.jobUrl})`;
  
  return `${header}${links}

\`\`\`
${error}
\`\`\`

---

Please check:
- The GitLab token has proper permissions
- The Anthropic API key is valid
- The trigger phrase is correct

If the issue persists, please check the configuration or contact your administrator.`;
}

export function createSuccessCommentBody(
  summary: string,
  context: GitLabContext,
  branchName?: string,
  mrUrl?: string,
  duration?: string
): string {
  const username = context.triggerUsername || 'user';
  let header = `**Claude finished @${username}'s task`;
  
  if (duration) {
    header += ` in ${duration}`;
  }
  header += '**';
  
  // Build links section
  let links = ` —— [View job](${context.jobUrl})`;
  
  if (branchName) {
    const branchUrl = `${context.webUrl}/-/tree/${branchName}`;
    links += ` • [\`${branchName}\`](${branchUrl})`;
  }
  
  if (mrUrl) {
    links += ` • [Create MR ➔](${mrUrl})`;
  }
  
  return `${header}${links}

---

${summary}`;
}

export function createUpdateSection(
  status: 'success' | 'error' | 'progress',
  message: string,
  context: GitLabContext,
  duration?: string,
  additionalInfo?: {
    branchName?: string;
    mrUrl?: string;
  }
): string {
  const timestamp = new Date().toLocaleTimeString();
  let statusEmoji = '';
  let statusText = '';
  
  switch (status) {
    case 'success':
      statusEmoji = '✅';
      statusText = 'Completed';
      break;
    case 'error':
      statusEmoji = '❌';
      statusText = 'Error';
      break;
    case 'progress':
      statusEmoji = '⏳';
      statusText = 'In Progress';
      break;
  }
  
  let update = `**${statusEmoji} ${statusText}** _(${timestamp}`;
  if (duration) {
    update += `, duration: ${duration}`;
  }
  update += ')_\n\n';
  
  update += message;
  
  if (additionalInfo?.branchName || additionalInfo?.mrUrl) {
    update += '\n\n';
    if (additionalInfo.branchName) {
      const branchUrl = `${context.webUrl}/-/tree/${additionalInfo.branchName}`;
      update += `- Branch: [\`${additionalInfo.branchName}\`](${branchUrl})\n`;
    }
    if (additionalInfo.mrUrl) {
      update += `- Merge Request: [View MR](${additionalInfo.mrUrl})\n`;
    }
  }
  
  if (status === 'error' || status === 'success') {
    update += `\n[View job logs](${context.jobUrl})`;
  }
  
  return update;
}