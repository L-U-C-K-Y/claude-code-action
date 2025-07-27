/**
 * Format GitLab data for Claude Code prompt generation
 */

import type {
  GitLabContext,
  GitLabMergeRequest,
  GitLabIssue,
  GitLabDiscussion,
  GitLabDiff,
  GitLabCommit,
  FetchDataResult
} from './types';

export function formatGitLabDataForPrompt(
  data: FetchDataResult,
  context: GitLabContext
): string {
  const { context: entity, discussions, changes, commits } = data;
  
  let prompt = '';

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

  // Add discussions
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

  // Add context about the current job
  prompt += `### CI/CD Context\n`;
  prompt += `- **Job:** [View logs](${context.jobUrl})\n`;
  prompt += `- **Pipeline:** ${context.pipelineId}\n`;
  prompt += `- **Triggered by:** @${context.triggerUser}\n`;

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
  
  return `## 🤖 Claude is thinking...

I'll analyze this ${entityType} and respond shortly.

**[View job logs](${context.jobUrl})**

---
<details>
<summary>Progress</summary>

- [ ] Analyzing ${entityType} context
- [ ] Understanding the request
- [ ] Preparing response
- [ ] Implementing changes (if needed)

</details>`;
}

export function createErrorCommentBody(error: string, context: GitLabContext): string {
  return `## ❌ Claude encountered an error

I'm sorry, but I encountered an error while processing this request:

\`\`\`
${error}
\`\`\`

**[View job logs](${context.jobUrl})** for more details.

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
  mrUrl?: string
): string {
  let body = `## ✅ Claude has completed the task

${summary}

**[View job logs](${context.jobUrl})**`;

  if (branchName) {
    body += `\n\n**Branch:** \`${branchName}\``;
  }

  if (mrUrl) {
    body += `\n**Merge Request:** ${mrUrl}`;
  }

  return body;
}