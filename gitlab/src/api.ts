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
  CreateReplyParams,
  UpdateCommentParams,
  FetchDataResult,
  TriggerCheckResult,
  TriggerComment,
  CategorizedComments
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
      // Get ALL discussions
      const discussions = context.isMR
        ? await this.gitlab.MergeRequestDiscussions.all(this.projectId, context.iid)
        : await this.gitlab.IssueDiscussions.all(this.projectId, context.iid);

      console.log(`Found ${discussions?.length || 0} discussions`);

      const triggerComments: TriggerComment[] = [];
      const claudeBotPattern = /claude[- ]?bot/i;
      
      // Check all discussions for triggers and existing Claude replies
      if (discussions && discussions.length > 0) {
        for (const discussion of discussions) {
          const notes = discussion.notes || [];
          let hasClaudeReply = false;
          const triggerNotesInDiscussion: GitLabNote[] = [];
          
          // Check each note in the discussion
          for (const note of notes) {
            // Check if this is a Claude bot reply
            if (note.author && typeof note.author === 'object' && 'username' in note.author && 
                typeof note.author.username === 'string' && claudeBotPattern.test(note.author.username)) {
              hasClaudeReply = true;
            }
            
            // Check if this is a trigger comment
            if (note.body && isValidTrigger(note.body, context)) {
              triggerNotesInDiscussion.push(note as unknown as GitLabNote);
            }
          }
          
          // Add trigger comments from this discussion
          for (const triggerNote of triggerNotesInDiscussion) {
            triggerComments.push({
              note: triggerNote,
              discussionId: discussion.id,
              hasClaudeReply
            });
          }
        }
      }
      
      console.log(`Found ${triggerComments.length} trigger comments`);
      console.log(`Triggers with existing Claude replies: ${triggerComments.filter(t => t.hasClaudeReply).length}`);
      
      // Check if we should run
      const newTriggers = triggerComments.filter(t => !t.hasClaudeReply);
      
      if (newTriggers.length > 0) {
        return {
          shouldRun: true,
          reason: `Found ${newTriggers.length} new trigger comment(s) without Claude replies`,
          triggerType: 'comment',
          triggerComments: newTriggers,
          hasExistingResponse: triggerComments.some(t => t.hasClaudeReply)
        };
      } else if (triggerComments.length > 0) {
        return {
          shouldRun: false,
          reason: 'All trigger comments already have Claude replies',
          triggerType: 'comment',
          triggerComments: [],
          hasExistingResponse: true
        };
      }

      // Check for assignment trigger (MR only)
      if (context.isMR) {
        const mr = await this.gitlab.MergeRequests.show(this.projectId, context.iid);
        if (mr.assignee?.username === 'claude-bot' || 
            mr.assignees?.some(a => a.username === 'claude-bot')) {
          return {
            shouldRun: true,
            reason: 'Claude bot is assigned',
            triggerType: 'assignment',
            triggerComments: [],
            hasExistingResponse: false
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
          triggerType: 'label',
          triggerComments: [],
          hasExistingResponse: false
        };
      }

      return {
        shouldRun: false,
        reason: 'No trigger found',
        triggerComments: [],
        hasExistingResponse: false
      };
    } catch (error) {
      console.error('Error checking trigger:', error);
      return {
        shouldRun: false,
        reason: `Error checking trigger: ${error}`,
        triggerComments: [],
        hasExistingResponse: false
      };
    }
  }

  /**
   * Fetch all relevant data for MR or Issue
   */
  async fetchData(context: GitLabContext): Promise<FetchDataResult> {
    let result: FetchDataResult;
    
    if (context.isMR) {
      // Fetch MR data
      const [mr, discussions, changes, commits] = await Promise.all([
        this.gitlab.MergeRequests.show(this.projectId, context.iid) as unknown as Promise<GitLabMergeRequest>,
        this.gitlab.MergeRequestDiscussions.all(this.projectId, context.iid) as unknown as Promise<GitLabDiscussion[]>,
        this.gitlab.MergeRequests.changes(this.projectId, context.iid).then(data => data.changes) as unknown as Promise<GitLabDiff[]>,
        this.gitlab.MergeRequests.commits(this.projectId, context.iid) as unknown as Promise<GitLabCommit[]>
      ]);

      result = {
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

      result = {
        context: issue,
        discussions
      };
    }
    
    // Categorize comments
    const categorized = this.categorizeComments(result.discussions, context);
    result.categorizedComments = categorized;
    
    return result;
  }
  
  /**
   * Categorize comments into triggers, context, resolved, and Claude replies
   */
  private categorizeComments(discussions: GitLabDiscussion[], context: GitLabContext): CategorizedComments {
    const triggerComments: GitLabNote[] = [];
    const contextComments: GitLabNote[] = [];
    const resolvedComments: GitLabNote[] = [];
    const claudeReplies: GitLabNote[] = [];
    const claudeBotPattern = /claude[- ]?bot/i;
    
    for (const discussion of discussions) {
      const notes = discussion.notes || [];
      const isResolved = discussion.resolved || false;
      let hasClaudeReply = false;
      
      // First pass: identify Claude replies
      for (const note of notes) {
        if (note.author && typeof note.author === 'object' && 'username' in note.author && 
            typeof note.author.username === 'string' && claudeBotPattern.test(note.author.username)) {
          claudeReplies.push(note as unknown as GitLabNote);
          hasClaudeReply = true;
        }
      }
      
      // Second pass: categorize other comments
      for (const note of notes) {
        // Skip Claude's own comments
        if (note.author && typeof note.author === 'object' && 'username' in note.author && 
            typeof note.author.username === 'string' && claudeBotPattern.test(note.author.username)) {
          continue;
        }
        
        const noteObj = note as unknown as GitLabNote;
        
        // Check if it's a trigger comment
        if (note.body && isValidTrigger(note.body, context)) {
          triggerComments.push(noteObj);
        } else if (isResolved) {
          resolvedComments.push(noteObj);
        } else {
          // It's a context comment (unresolved, non-trigger)
          contextComments.push(noteObj);
        }
      }
    }
    
    console.log(`Categorized comments: ${triggerComments.length} triggers, ${contextComments.length} context, ${resolvedComments.length} resolved, ${claudeReplies.length} Claude replies`);
    
    return {
      triggerComments,
      contextComments,
      resolvedComments,
      claudeReplies
    };
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
   * Create a reply to an existing discussion
   * For now, we'll create a new comment as a workaround since the discussion reply API
   * is not fully exposed in gitbeaker v35
   */
  async createReply(params: CreateReplyParams): Promise<GitLabNote> {
    // Workaround: Create a new note that references the discussion
    // This will appear in the same thread in the GitLab UI
    const replyBody = `> In reply to discussion ${params.discussionId}\n\n${params.body}`;
    
    if (params.isMR) {
      return await this.gitlab.MergeRequestNotes.create(
        params.projectId,
        params.iid,
        replyBody
      ) as unknown as GitLabNote;
    } else {
      return await this.gitlab.IssueNotes.create(
        params.projectId,
        params.iid,
        replyBody
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