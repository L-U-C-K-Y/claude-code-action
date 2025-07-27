import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { parseGitLabContext, getClaudeBranchName, isValidTrigger } from '../src/context';

describe('GitLab Context Parser', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('parseGitLabContext', () => {
    test('should parse MR context correctly', () => {
      process.env.CI_PROJECT_ID = '123';
      process.env.CI_PROJECT_PATH = 'group/project';
      process.env.CI_PROJECT_URL = 'https://gitlab.com/group/project';
      process.env.CI_MERGE_REQUEST_IID = '42';
      process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME = 'feature/test';
      process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME = 'main';
      process.env.GITLAB_USER_LOGIN = 'testuser';
      process.env.CI_JOB_ID = '999';
      process.env.CI_PIPELINE_ID = '888';
      process.env.CLAUDE_BOT_TOKEN = 'test-token';

      const context = parseGitLabContext();

      expect(context.isMR).toBe(true);
      expect(context.iid).toBe(42);
      expect(context.projectId).toBe('123');
      expect(context.sourceBranch).toBe('feature/test');
      expect(context.targetBranch).toBe('main');
      expect(context.triggerUser).toBe('testuser');
      expect(context.token).toBe('test-token');
    });

    test('should parse Issue context correctly', () => {
      process.env.CI_PROJECT_ID = '123';
      process.env.CI_PROJECT_PATH = 'group/project';
      process.env.CI_ISSUE_IID = '10';
      process.env.GITLAB_USER_LOGIN = 'testuser';
      process.env.CI_JOB_ID = '999';
      process.env.CLAUDE_BOT_TOKEN = 'test-token';

      const context = parseGitLabContext();

      expect(context.isMR).toBe(false);
      expect(context.iid).toBe(10);
      expect(context.sourceBranch).toBeUndefined();
      expect(context.targetBranch).toBeUndefined();
    });

    test('should throw error when no token is found', () => {
      process.env.CI_PROJECT_ID = '123';
      process.env.CI_MERGE_REQUEST_IID = '42';
      delete process.env.GITLAB_TOKEN;
      delete process.env.CLAUDE_BOT_TOKEN;
      delete process.env.CI_JOB_TOKEN;

      expect(() => parseGitLabContext()).toThrow('No GitLab token found');
    });
  });

  describe('getClaudeBranchName', () => {
    test('should use source branch for MR', () => {
      const context = {
        isMR: true,
        sourceBranch: 'feature/existing',
        iid: 42
      } as any;

      expect(getClaudeBranchName(context)).toBe('feature/existing');
    });

    test('should create new branch name for issue', () => {
      const context = {
        isMR: false,
        iid: 10
      } as any;

      const branchName = getClaudeBranchName(context);
      expect(branchName).toMatch(/^claude\/issue-10-\d+$/);
    });
  });

  describe('isValidTrigger', () => {
    test('should detect trigger phrase', () => {
      const context = { triggerPhrase: '@claude' } as any;
      
      expect(isValidTrigger('Hey @claude can you help?', context)).toBe(true);
      expect(isValidTrigger('Hey @CLAUDE can you help?', context)).toBe(true);
      expect(isValidTrigger('No trigger here', context)).toBe(false);
    });
  });
});