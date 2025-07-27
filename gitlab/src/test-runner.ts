#!/usr/bin/env bun

/**
 * Test runner for GitLab integration
 * This allows testing without the upstream dependencies
 */

import { parseGitLabContext } from './context';
import { GitLabAPI } from './api';
import { 
  formatGitLabDataForPrompt, 
  createInitialCommentBody, 
  createErrorCommentBody, 
  createSuccessCommentBody 
} from './formatter';

async function testRunner() {
  console.log('🧪 Claude GitLab Integration Test Runner\n');

  // Test 1: Context parsing
  console.log('1️⃣ Testing context parsing...');
  try {
    const context = parseGitLabContext();
    console.log('✅ Context parsed successfully:');
    console.log(`   - Project: ${context.projectPath} (ID: ${context.projectId})`);
    console.log(`   - Type: ${context.isMR ? 'Merge Request' : 'Issue'} #${context.iid}`);
    console.log(`   - Trigger: ${context.triggerPhrase}`);
    console.log(`   - API URL: ${context.apiUrl}\n`);
  } catch (error) {
    console.log(`❌ Context parsing failed: ${error}\n`);
  }

  // Test 2: API connection (if token is provided)
  if (process.env.GITLAB_TOKEN || process.env.CLAUDE_BOT_TOKEN) {
    console.log('2️⃣ Testing GitLab API connection...');
    try {
      const context = parseGitLabContext();
      const api = new GitLabAPI(context.token, context.apiUrl, context.projectId);
      
      // Try to get project info
      const project = await api.getProject();
      console.log('✅ API connection successful:');
      console.log(`   - Project: ${project.name_with_namespace}`);
      console.log(`   - Default branch: ${project.default_branch}\n`);
    } catch (error) {
      console.log(`❌ API connection failed: ${error}\n`);
    }
  } else {
    console.log('2️⃣ Skipping API test (no token provided)\n');
  }

  // Test 3: Comment formatting
  console.log('3️⃣ Testing comment formatters...');
  try {
    const mockContext = {
      isMR: true,
      iid: 42,
      jobUrl: 'https://gitlab.com/test/project/-/jobs/123',
      pipelineId: '456'
    } as any;

    const initialComment = createInitialCommentBody(mockContext);
    console.log('✅ Initial comment format:');
    console.log(initialComment.split('\n').slice(0, 3).join('\n') + '...\n');

    const errorComment = createErrorCommentBody('Test error message', mockContext);
    console.log('✅ Error comment format:');
    console.log(errorComment.split('\n').slice(0, 3).join('\n') + '...\n');

    const successComment = createSuccessCommentBody('Test completed successfully', mockContext, 'test-branch');
    console.log('✅ Success comment format:');
    console.log(successComment.split('\n').slice(0, 3).join('\n') + '...\n');
  } catch (error) {
    console.log(`❌ Comment formatting failed: ${error}\n`);
  }

  // Test 4: Data formatting
  console.log('4️⃣ Testing data formatter...');
  try {
    const mockData = {
      context: {
        iid: 42,
        title: 'Test MR',
        author: { username: 'testuser' },
        source_branch: 'feature/test',
        target_branch: 'main',
        state: 'opened',
        web_url: 'https://gitlab.com/test/project/-/merge_requests/42',
        description: 'Test description'
      },
      discussions: [{
        notes: [{
          author: { username: 'user1' },
          body: 'Test comment',
          created_at: new Date().toISOString(),
          system: false
        }]
      }],
      changes: [],
      commits: []
    } as any;

    const mockContext = {
      isMR: true,
      jobUrl: 'https://gitlab.com/test/project/-/jobs/123',
      pipelineId: '456',
      triggerUser: 'testuser'
    } as any;

    const prompt = formatGitLabDataForPrompt(mockData, mockContext);
    console.log('✅ Prompt format (first 200 chars):');
    console.log(prompt.substring(0, 200) + '...\n');
  } catch (error) {
    console.log(`❌ Data formatting failed: ${error}\n`);
  }

  console.log('🎉 Test runner complete!\n');
  
  console.log('💡 To test with a real GitLab project:');
  console.log('   1. Set GITLAB_TOKEN or CLAUDE_BOT_TOKEN');
  console.log('   2. Set CI_PROJECT_ID to your project ID');
  console.log('   3. Set CI_MERGE_REQUEST_IID or CI_ISSUE_IID');
  console.log('   4. Run this test again\n');
}

// Run the test
testRunner().catch(console.error);