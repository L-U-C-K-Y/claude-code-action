import { join } from 'path';
import type { GitLabContext } from './types';

interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string | undefined>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export function prepareMcpConfig(
  context: GitLabContext,
  claudeCommentId: string
): string {
  // Create MCP configuration
  const mcpConfig: McpConfig = {
    mcpServers: {
      gitlab_comment: {
        command: "bun",
        args: [
          "run",
          join(__dirname, "mcp", "gitlab-comment-server.ts")
        ],
        env: {
          GITLAB_TOKEN: context.token,
          GITLAB_PROJECT_ID: context.projectId,
          GITLAB_API_URL: context.apiUrl,
          CLAUDE_COMMENT_ID: claudeCommentId,
          GITLAB_IS_MR: context.isMR ? 'true' : 'false',
          GITLAB_IID: context.iid.toString()
        }
      }
    }
  };

  // Add pipeline server for merge requests
  if (context.isMR) {
    mcpConfig.mcpServers.gitlab_pipeline = {
      command: "bun",
      args: [
        "run",
        join(__dirname, "mcp", "gitlab-pipeline-server.ts")
      ],
      env: {
        GITLAB_TOKEN: context.token,
        GITLAB_PROJECT_ID: context.projectId,
        GITLAB_API_URL: context.apiUrl,
        MERGE_REQUEST_IID: context.iid.toString(),
        RUNNER_TEMP: process.env.RUNNER_TEMP || "/tmp"
      }
    };
  }

  // Check if user has additional MCP config
  const additionalMcpConfig = process.env.CLAUDE_ADDITIONAL_MCP_CONFIG;
  if (additionalMcpConfig && additionalMcpConfig.trim()) {
    try {
      const additionalConfig = JSON.parse(additionalMcpConfig);
      
      // Validate that parsed JSON is an object
      if (typeof additionalConfig !== "object" || additionalConfig === null) {
        throw new Error("MCP config must be a valid JSON object");
      }

      console.log("Merging additional MCP server configuration with built-in servers");
      
      // Merge mcpServers if present
      if (additionalConfig.mcpServers && typeof additionalConfig.mcpServers === "object") {
        mcpConfig.mcpServers = {
          ...mcpConfig.mcpServers,
          ...additionalConfig.mcpServers,
        };
      }
    } catch (error) {
      console.error(`Error parsing additional MCP config: ${error}`);
      throw new Error(`Invalid CLAUDE_ADDITIONAL_MCP_CONFIG: ${error}`);
    }
  }

  console.log('MCP servers configured:', Object.keys(mcpConfig.mcpServers).join(', '));
  
  // Return the JSON string for Claude's --mcp-config option
  return JSON.stringify(mcpConfig, null, 2);
}