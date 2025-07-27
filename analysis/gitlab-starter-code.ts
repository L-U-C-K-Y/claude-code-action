// gitlab-starter-code.ts - Basic structure to get started

import { Gitlab } from '@gitbeaker/node';

// Simple GitLab API wrapper
export class GitLabAPI {
  private gitlab: InstanceType<typeof Gitlab>;
  private projectId: string;

  constructor(token: string, projectId: string) {
    this.gitlab = new Gitlab({
      token,
      host: process.env.CI_API_V4_URL || 'https://gitlab.com'
    });
    this.projectId = projectId;
  }

  // Get MR or Issue details
  async getContext(isMR: boolean, iid: number) {
    if (isMR) {
      const mr = await this.gitlab.MergeRequests.show(this.projectId, iid);
      const discussions = await this.gitlab.MergeRequestDiscussions.all(this.projectId, iid);
      return { type: 'merge_request', data: mr, discussions };
    } else {
      const issue = await this.gitlab.Issues.show(this.projectId, iid);
      const discussions = await this.gitlab.IssueDiscussions.all(this.projectId, iid);
      return { type: 'issue', data: issue, discussions };
    }
  }

  // Create or update comment
  async postComment(isMR: boolean, iid: number, noteId: number | null, body: string) {
    if (isMR) {
      if (noteId) {
        return await this.gitlab.MergeRequestNotes.edit(this.projectId, iid, noteId, body);
      }
      return await this.gitlab.MergeRequestNotes.create(this.projectId, iid, body);
    } else {
      if (noteId) {
        return await this.gitlab.IssueNotes.edit(this.projectId, iid, noteId, body);
      }
      return await this.gitlab.IssueNotes.create(this.projectId, iid, body);
    }
  }

  // Create branch for issue
  async createBranch(branchName: string, ref: string = 'main') {
    return await this.gitlab.Branches.create(this.projectId, branchName, ref);
  }
}

// Parse GitLab CI environment
export function parseGitLabContext() {
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
    triggerPhrase: process.env.CLAUDE_TRIGGER_PHRASE || '@claude'
  };
}

// Check if we should respond
export async function checkTrigger(api: GitLabAPI, context: ReturnType<typeof parseGitLabContext>) {
  // Get recent discussions
  const { discussions } = await api.getContext(context.isMR, context.iid);
  
  // Check last comment for trigger phrase
  const lastDiscussion = discussions[discussions.length - 1];
  if (!lastDiscussion) return false;
  
  const lastNote = lastDiscussion.notes[lastDiscussion.notes.length - 1];
  return lastNote.body.includes(context.triggerPhrase);
}

// Main entry point
export async function main() {
  console.log('🤖 Claude GitLab Integration Starting...');
  
  // 1. Setup
  const context = parseGitLabContext();
  const api = new GitLabAPI(process.env.GITLAB_TOKEN!, context.projectId);
  
  // 2. Check trigger
  if (!await checkTrigger(api, context)) {
    console.log('No Claude trigger found, exiting');
    process.exit(0);
  }
  
  // 3. Post initial comment
  const comment = await api.postComment(
    context.isMR,
    context.iid,
    null,
    `## 🤖 Claude is thinking...

I'll analyze this ${context.isMR ? 'merge request' : 'issue'} and respond shortly.

[View job logs](${context.jobUrl})`
  );
  
  // 4. Get full context
  const fullContext = await api.getContext(context.isMR, context.iid);
  
  // 5. Create branch if needed (for issues)
  if (!context.isMR && !context.sourceBranch) {
    const branchName = `claude/issue-${context.iid}-${Date.now()}`;
    await api.createBranch(branchName, context.defaultBranch);
    console.log(`Created branch: ${branchName}`);
  }
  
  // 6. Prepare prompt for Claude
  const prompt = `You are Claude, an AI assistant helping with a GitLab ${fullContext.type}.

${fullContext.type === 'merge_request' ? 'Merge Request' : 'Issue'} Title: ${fullContext.data.title}
Description: ${fullContext.data.description || 'No description provided'}

Recent discussions:
${fullContext.discussions.map(d => 
  d.notes.map(n => `@${n.author.username}: ${n.body}`).join('\n')
).join('\n\n')}

Please help with the request mentioned in the comments.`;

  // 7. Run Claude (using the generic base-action)
  // This part integrates with the copied generic files
  console.log('Running Claude with prompt...');
  
  // 8. Update comment with results
  await api.postComment(
    context.isMR,
    context.iid,
    comment.id,
    `## ✅ Claude's Response

Here's what I found...

[Implementation would go here]`
  );
  
  console.log('✅ Claude GitLab Integration Complete!');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}