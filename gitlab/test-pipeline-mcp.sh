#!/bin/bash
# Test script for GitLab Pipeline MCP Server

echo "Testing GitLab Pipeline MCP Server..."

# Set test environment variables
export GITLAB_TOKEN="${GITLAB_TOKEN:-your-token-here}"
export GITLAB_PROJECT_ID="${GITLAB_PROJECT_ID:-247}"
export GITLAB_API_URL="${GITLAB_API_URL:-https://gitlab.com/api/v4}"
export MERGE_REQUEST_IID="${MERGE_REQUEST_IID:-1}"
export RUNNER_TEMP="/tmp"

# Create a simple test client
cat > /tmp/test-pipeline-client.ts << 'EOF'
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function testPipelineServer() {
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", process.argv[2]],
    env: process.env as Record<string, string>
  });

  const client = new Client({
    name: "test-pipeline-client",
    version: "1.0.0",
  });

  await client.connect(transport);
  console.log("Connected to GitLab Pipeline MCP Server");

  // Test getting pipeline status
  console.log("\n1. Testing get_pipeline_status:");
  const statusResult = await client.callTool({
    name: "get_pipeline_status",
    arguments: {}
  });
  console.log(JSON.stringify(statusResult, null, 2));

  // If we have pipelines, test getting jobs for the latest one
  const statusData = JSON.parse(statusResult.content[0].text);
  if (statusData.summary.latest_pipeline) {
    console.log("\n2. Testing get_pipeline_jobs:");
    const jobsResult = await client.callTool({
      name: "get_pipeline_jobs",
      arguments: {
        pipeline_id: statusData.summary.latest_pipeline.id
      }
    });
    console.log(JSON.stringify(jobsResult, null, 2));

    // If we have failed jobs, test downloading logs
    const jobsData = JSON.parse(jobsResult.content[0].text);
    const failedJob = jobsData.jobs.find((j: any) => j.status === 'failed');
    if (failedJob) {
      console.log("\n3. Testing download_job_log for failed job:");
      const logResult = await client.callTool({
        name: "download_job_log",
        arguments: {
          job_id: failedJob.id
        }
      });
      console.log(JSON.stringify(logResult, null, 2));
    }
  }

  await client.close();
}

testPipelineServer().catch(console.error);
EOF

# Check if server file exists
SERVER_PATH="./src/mcp/gitlab-pipeline-server.ts"
if [ ! -f "$SERVER_PATH" ]; then
  echo "Error: GitLab Pipeline MCP Server not found at $SERVER_PATH"
  exit 1
fi

echo "Starting test with configuration:"
echo "  GITLAB_PROJECT_ID: $GITLAB_PROJECT_ID"
echo "  MERGE_REQUEST_IID: $MERGE_REQUEST_IID"
echo "  GITLAB_API_URL: $GITLAB_API_URL"
echo ""

# Run the test
bun run /tmp/test-pipeline-client.ts "$SERVER_PATH"