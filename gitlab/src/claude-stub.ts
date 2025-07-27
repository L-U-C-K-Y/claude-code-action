/**
 * Stub implementations for testing without upstream dependencies
 * Replace these with actual imports when in fork structure
 */

export function validateEnvironmentVariables() {
  // Basic validation for GitLab integration
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  
  if (!process.env.GITLAB_TOKEN && !process.env.CLAUDE_BOT_TOKEN) {
    throw new Error('GITLAB_TOKEN or CLAUDE_BOT_TOKEN is required');
  }
}

export async function runClaude(promptFile: string, options: any) {
  console.log('🤖 [STUB] Would run Claude with:');
  console.log(`   - Prompt file: ${promptFile}`);
  console.log(`   - Model: ${options.model || 'default'}`);
  console.log(`   - API Key: ${options.apiKey ? '***' : 'not provided'}`);
  
  // Simulate Claude making some changes
  if (process.env.SIMULATE_CHANGES === 'true') {
    console.log('   - Simulating file changes...');
    // In real implementation, Claude would modify files here
  }
  
  return {
    success: true,
    message: 'Stub execution completed'
  };
}

export async function preparePrompt(content: string, options?: any) {
  // For GitLab, we just write the content directly
  const tempFile = `/tmp/claude-prompt-${Date.now()}.txt`;
  console.log(`📝 [STUB] Preparing prompt at: ${tempFile}`);
  
  // In real implementation, this would format the prompt properly
  return tempFile;
}