/**
 * GitLab API wrapper for Claude Code integration
 */

import { Gitlab } from '@gitbeaker/node';
import type {
  GitLabContext,
  GitLabMergeRequest,
  GitLabIssue,
  GitLabDiscussion,
  GitLabNote,
  GitLabDiff,
  GitLabCommit,
  CreateCommentParams,
  UpdateCommentParams,
  FetchDataResult,
  TriggerCheckResult
} from './types';
import { isValidTrigger } from './context';

export class GitLabAPI {
  private gitlab: InstanceType<typeof Gitlab>;
  private projectId: string;

  constructor(token: string, apiUrl: string, projectId: string) {
    this.gitlab = new Gitlab({
      token,
      host: apiUrl.replace('/api/v4', ''), // Remove API suffix if present
      requestTimeout: 30000
    });
    this.projectId = projectId;
  }

  /**
   * Check if Claude should respond based on recent activity
   */
  async checkTrigger(context: GitLabContext): Promise<TriggerCheckResult> {
    try {
      // Get recent discussions
      const discussions = context.isMR
        ? await this.gitlab.MergeRequestDiscussions.all(this.projectId, context.iid)
        : await this.gitlab.IssueDiscussions.all(this.projectId, context.iid);

      console.log(`Found ${discussions?.length || 0} discussions`);

      // Check all notes across all discussions for trigger
      if (discussions && discussions.length > 0) {
        // Flatten all notes from all discussions and sort by created_at
        const allNotes = discussions
          .flatMap(d => d.notes || [])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        console.log(`Total notes across all discussions: ${allNotes.length}`);
        
        // Check most recent notes (last 5) for trigger
        const recentNotes = allNotes.slice(0, 5);
        console.log(`Checking ${recentNotes.length} most recent notes for trigger phrase "${context.triggerPhrase}"`);
        
        for (const note of recentNotes) {
          console.log(`Note from ${note.author?.username}: "${note.body?.substring(0, 50)}..."`);
          if (note.body && isValidTrigger(note.body, context)) {
            return {
              shouldRun: true,
              reason: 'Found trigger phrase in recent comment',
              triggerType: 'comment',
              triggerComment: note as unknown as GitLabNote
            };
          }
        }
      }

      // Check for assignment trigger (MR only)
      if (context.isMR) {
        const mr = await this.gitlab.MergeRequests.show(this.projectId, context.iid);
        if (mr.assignee?.username === 'claude-bot' || 
            mr.assignees?.some(a => a.username === 'claude-bot')) {
          return {
            shouldRun: true,
            reason: 'Claude bot is assigned',
            triggerType: 'assignment'
          };
        }
      }

      // Check for label trigger
      const entity = context.isMR
        ? await this.gitlab.MergeRequests.show(this.projectId, context.iid)
        : await this.gitlab.Issues.show(this.projectId, context.iid);

      if (entity.labels?.includes('claude')) {
        return {
          shouldRun: true,
          reason: 'Found claude label',
          triggerType: 'label'
        };
      }

      return {
        shouldRun: false,
        reason: 'No trigger found'
      };
    } catch (error) {
      console.error('Error checking trigger:', error);
      return {
        shouldRun: false,
        reason: `Error checking trigger: ${error}`
      };
    }
  }

  /**
   * Fetch all relevant data for MR or Issue
   */
  async fetchData(context: GitLabContext): Promise<FetchDataResult> {
    if (context.isMR) {
      // Fetch MR data
      const [mr, discussions, changes, commits] = await Promise.all([
        this.gitlab.MergeRequests.show(this.projectId, context.iid) as unknown as Promise<GitLabMergeRequest>,
        this.gitlab.MergeRequestDiscussions.all(this.projectId, context.iid) as unknown as Promise<GitLabDiscussion[]>,
        this.gitlab.MergeRequests.changes(this.projectId, context.iid).then(data => data.changes) as unknown as Promise<GitLabDiff[]>,
        this.gitlab.MergeRequests.commits(this.projectId, context.iid) as unknown as Promise<GitLabCommit[]>
      ]);

      return {
        context: mr,
        discussions,
        changes,
        commits
      };
    } else {
      // Fetch Issue data
      const [issue, discussions] = await Promise.all([
        this.gitlab.Issues.show(this.projectId, context.iid) as unknown as Promise<GitLabIssue>,
        this.gitlab.IssueDiscussions.all(this.projectId, context.iid) as unknown as Promise<GitLabDiscussion[]>
      ]);

      return {
        context: issue,
        discussions
      };
    }
  }

  /**
   * Create a new comment
   */
  async createComment(params: CreateCommentParams): Promise<GitLabNote> {
    if (params.isMR) {
      return await this.gitlab.MergeRequestNotes.create(
        params.projectId,
        params.iid,
        params.body
      ) as unknown as GitLabNote;
    } else {
      return await this.gitlab.IssueNotes.create(
        params.projectId,
        params.iid,
        params.body
      ) as unknown as GitLabNote;
    }
  }

  /**
   * Update an existing comment
   */
  async updateComment(params: UpdateCommentParams): Promise<GitLabNote> {
    if (params.isMR) {
      return await this.gitlab.MergeRequestNotes.edit(
        params.projectId,
        params.iid,
        params.noteId,
        params.body
      ) as unknown as GitLabNote;
    } else {
      return await this.gitlab.IssueNotes.edit(
        params.projectId,
        params.iid,
        params.noteId,
        params.body
      ) as unknown as GitLabNote;
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, ref: string): Promise<void> {
    await this.gitlab.Branches.create(
      this.projectId,
      branchName,
      ref
    );
  }

  /**
   * Check if a branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      await this.gitlab.Branches.show(this.projectId, branchName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a merge request
   */
  async createMergeRequest(
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description: string
  ): Promise<GitLabMergeRequest> {
    return await this.gitlab.MergeRequests.create(
      this.projectId,
      sourceBranch,
      targetBranch,
      title,
      {
        description,
        remove_source_branch: true,
        assignee_id: undefined, // Let user assign manually
        labels: ['claude-generated']
      }
    ) as unknown as GitLabMergeRequest;
  }

  /**
   * Get project information
   */
  async getProject() {
    return await this.gitlab.Projects.show(this.projectId);
  }
}