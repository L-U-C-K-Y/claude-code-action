#!/usr/bin/env bun
// GitLab Comment MCP Server - Provides comment update functionality for GitLab
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GitLabAPI } from "../api";

// Get repository information from environment variables
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID;
const GITLAB_API_URL = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4';
const CLAUDE_COMMENT_ID = process.env.CLAUDE_COMMENT_ID;
const GITLAB_IS_MR = process.env.GITLAB_IS_MR === 'true';
const GITLAB_IID = process.env.GITLAB_IID;

if (!GITLAB_TOKEN || !GITLAB_PROJECT_ID || !CLAUDE_COMMENT_ID || !GITLAB_IID) {
  console.error(
    "Error: GITLAB_TOKEN, GITLAB_PROJECT_ID, CLAUDE_COMMENT_ID, and GITLAB_IID environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "GitLab Comment Server",
  version: "0.0.1",
});

server.tool(
  "update_claude_comment",
  "Update the Claude comment with progress and results in GitLab (automatically handles both issue and MR comments)",
  {
    body: z.string().describe("The updated comment content"),
  },
  async ({ body }) => {
    try {
      const api = new GitLabAPI(GITLAB_TOKEN, GITLAB_API_URL, GITLAB_PROJECT_ID);
      
      // Update the comment using our existing API method
      const result = await api.updateComment({
        projectId: GITLAB_PROJECT_ID,
        isMR: GITLAB_IS_MR,
        iid: parseInt(GITLAB_IID, 10),
        noteId: parseInt(CLAUDE_COMMENT_ID, 10),
        body: body
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              commentId: result.id,
              url: result.web_url || `Updated comment ${result.id}`
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`GitLab Comment MCP Server started`);
  
  process.on("exit", () => {
    server.close();
  });
  
  process.on("SIGINT", () => {
    server.close();
    process.exit(0);
  });
  
  process.on("SIGTERM", () => {
    server.close();
    process.exit(0);
  });
}

runServer().catch(console.error);