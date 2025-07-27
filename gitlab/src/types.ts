/**
 * GitLab-specific type definitions
 */

export interface GitLabContext {
  // Project information
  projectId: string;
  projectPath: string;
  projectUrl: string;
  webUrl: string;
  
  // MR/Issue context
  isMR: boolean;
  iid: number;
  
  // User and trigger info
  triggerUser: string;
  triggerUsername: string; // alias for triggerUser for compatibility
  triggerPhrase: string;
  
  // Branch information
  defaultBranch: string;
  sourceBranch?: string;
  targetBranch?: string;
  
  // CI/CD context
  jobId: string;
  jobUrl: string;
  pipelineId: string;
  pipelineUrl: string;
  
  // Authentication
  token: string;
  apiUrl: string;
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatar_url?: string;
  web_url: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  author: GitLabUser;
  created_at: string;
  updated_at: string;
  system: boolean;
  noteable_id: number;
  noteable_type: 'MergeRequest' | 'Issue';
  noteable_iid: number;
}

export interface GitLabDiscussion {
  id: string;
  individual_note: boolean;
  notes: GitLabNote[];
  resolved?: boolean;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: 'opened' | 'closed' | 'locked' | 'merged';
  created_at: string;
  updated_at: string;
  source_branch: string;
  target_branch: string;
  source_project_id: number;
  target_project_id: number;
  author: GitLabUser;
  assignee?: GitLabUser;
  assignees?: GitLabUser[];
  labels: string[];
  draft: boolean;
  work_in_progress: boolean;
  merge_status: string;
  sha: string;
  diff_refs: {
    base_sha: string;
    head_sha: string;
    start_sha: string;
  };
  changes_count?: string;
  web_url: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: 'opened' | 'closed';
  created_at: string;
  updated_at: string;
  author: GitLabUser;
  assignee?: GitLabUser;
  assignees?: GitLabUser[];
  labels: string[];
  web_url: string;
}

export interface GitLabDiff {
  old_path: string;
  new_path: string;
  a_mode: string;
  b_mode: string;
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  created_at: string;
  parent_ids: string[];
}

export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  default_branch: string;
  web_url: string;
  http_url_to_repo: string;
}

export interface TriggerCheckResult {
  shouldRun: boolean;
  reason: string;
  triggerType?: 'comment' | 'assignment' | 'label';
  triggerComments: TriggerComment[];
  hasExistingResponse: boolean;
}

export interface TriggerComment {
  note: GitLabNote;
  discussionId: string;
  hasClaudeReply: boolean;
}

export interface CreateCommentParams {
  projectId: string;
  isMR: boolean;
  iid: number;
  body: string;
}

export interface CreateReplyParams {
  projectId: string;
  isMR: boolean;
  iid: number;
  discussionId: string;
  noteId: number;
  body: string;
}

export interface UpdateCommentParams extends CreateCommentParams {
  noteId: number;
}

export interface FetchDataResult {
  context: GitLabMergeRequest | GitLabIssue;
  discussions: GitLabDiscussion[];
  changes?: GitLabDiff[];
  commits?: GitLabCommit[];
  categorizedComments?: CategorizedComments;
}

export interface CategorizedComments {
  triggerComments: GitLabNote[];
  contextComments: GitLabNote[];
  resolvedComments: GitLabNote[];
  claudeReplies: GitLabNote[];
}