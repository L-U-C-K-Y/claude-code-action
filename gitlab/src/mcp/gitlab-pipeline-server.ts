#!/usr/bin/env bun
// GitLab Pipeline MCP Server - Provides pipeline analysis tools for GitLab
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Gitlab } from "@gitbeaker/node";
import { mkdir, writeFile } from "fs/promises";

// Get configuration from environment variables
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID;
const GITLAB_API_URL = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4';
const MERGE_REQUEST_IID = process.env.MERGE_REQUEST_IID;
const RUNNER_TEMP = process.env.RUNNER_TEMP || "/tmp";

if (!GITLAB_TOKEN || !GITLAB_PROJECT_ID || !MERGE_REQUEST_IID) {
  console.error(
    "[GitLab Pipeline Server] Error: GITLAB_TOKEN, GITLAB_PROJECT_ID, and MERGE_REQUEST_IID environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "GitLab Pipeline Server",
  version: "0.0.1",
});

console.error("[GitLab Pipeline Server] MCP Server instance created");

// Initialize GitLab client
const gitlab = new Gitlab({
  token: GITLAB_TOKEN,
  host: GITLAB_API_URL.replace('/api/v4', ''), // Remove API suffix if present
  requestTimeout: 30000
});

server.tool(
  "get_pipeline_status",
  "Get pipeline status summary for this merge request",
  {
    status: z
      .enum([
        "created",
        "waiting_for_resource",
        "preparing",
        "pending",
        "running",
        "success",
        "failed",
        "canceled",
        "skipped",
        "manual",
        "scheduled"
      ])
      .optional()
      .describe("Filter pipelines by status"),
  },
  async ({ status }) => {
    try {
      // Get pipelines for the merge request
      const pipelines = await gitlab.MergeRequests.pipelines(
        GITLAB_PROJECT_ID,
        parseInt(MERGE_REQUEST_IID, 10)
      ) as any[];

      // Filter by status if provided
      const filteredPipelines = status 
        ? pipelines.filter(p => p.status === status)
        : pipelines;

      // Process pipelines to create summary
      const summary = {
        total_pipelines: filteredPipelines.length,
        failed: 0,
        passed: 0,
        running: 0,
        pending: 0,
        canceled: 0,
        latest_pipeline: null as any
      };

      const processedPipelines = filteredPipelines.map((pipeline: any) => {
        // Update summary counts
        switch (pipeline.status) {
          case "success":
            summary.passed++;
            break;
          case "failed":
            summary.failed++;
            break;
          case "running":
          case "preparing":
            summary.running++;
            break;
          case "pending":
          case "created":
          case "waiting_for_resource":
            summary.pending++;
            break;
          case "canceled":
            summary.canceled++;
            break;
        }

        return {
          id: pipeline.id,
          status: pipeline.status,
          ref: pipeline.ref,
          sha: pipeline.sha,
          web_url: pipeline.web_url,
          created_at: pipeline.created_at,
          updated_at: pipeline.updated_at,
        };
      });

      // Set latest pipeline
      if (processedPipelines.length > 0) {
        summary.latest_pipeline = processedPipelines[0];
      }

      const result = {
        summary,
        pipelines: processedPipelines,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

server.tool(
  "get_pipeline_jobs",
  "Get job details for a specific pipeline",
  {
    pipeline_id: z.number().describe("The pipeline ID"),
  },
  async ({ pipeline_id }) => {
    try {
      // Get jobs for this pipeline
      const jobs = await gitlab.Jobs.all(
        GITLAB_PROJECT_ID,
        { pipelineId: pipeline_id }
      ) as any[];

      const processedJobs = jobs.map((job: any) => {
        return {
          id: job.id,
          name: job.name,
          stage: job.stage,
          status: job.status,
          started_at: job.started_at,
          finished_at: job.finished_at,
          duration: job.duration,
          web_url: job.web_url,
          failure_reason: job.failure_reason,
          allow_failure: job.allow_failure,
          // Include error message if job failed
          ...(job.status === 'failed' && {
            failure_message: `Job failed: ${job.failure_reason || 'Unknown reason'}`
          })
        };
      });

      // Group jobs by stage
      const stages: Record<string, any[]> = {};
      processedJobs.forEach(job => {
        if (!stages[job.stage]) {
          stages[job.stage] = [];
        }
        stages[job.stage].push(job);
      });

      const result = {
        total_jobs: processedJobs.length,
        failed_jobs: processedJobs.filter(j => j.status === 'failed' && !j.allow_failure).length,
        stages,
        jobs: processedJobs,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

server.tool(
  "download_job_log",
  "Download job logs to disk for analysis",
  {
    job_id: z.number().describe("The job ID"),
  },
  async ({ job_id }) => {
    try {
      // Get the job trace (log) using @gitbeaker's downloadTraceFile method
      const traceData = await gitlab.Jobs.downloadTraceFile(GITLAB_PROJECT_ID, job_id);
      const trace = typeof traceData === 'string' ? traceData : JSON.stringify(traceData);

      // Create logs directory
      const logsDir = `${RUNNER_TEMP}/gitlab-pipeline-logs`;
      await mkdir(logsDir, { recursive: true });

      // Write log to file
      const logPath = `${logsDir}/job-${job_id}.log`;
      await writeFile(logPath, trace, "utf-8");

      // Extract error summary if job failed
      const errorLines: string[] = [];
      const lines = trace.split('\n');
      let collectingError = false;
      
      for (const line of lines) {
        // Look for common error patterns
        if (line.includes('ERROR:') || 
            line.includes('FAILED:') || 
            line.includes('error:') ||
            line.includes('Error:') ||
            line.includes('✗') ||
            line.includes('FAIL')) {
          collectingError = true;
        }
        
        if (collectingError) {
          errorLines.push(line);
          // Stop after collecting some context
          if (errorLines.length > 20) break;
        }
      }

      const result = {
        path: logPath,
        size_bytes: Buffer.byteLength(trace, "utf-8"),
        line_count: lines.length,
        ...(errorLines.length > 0 && {
          error_summary: errorLines.join('\n')
        })
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[GitLab Pipeline Server] Connected and ready`);
    
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
  } catch (error) {
    console.error("[GitLab Pipeline Server] Error:", error);
    throw error;
  }
}

runServer().catch((error) => {
  console.error("[GitLab Pipeline Server] Fatal error:", error);
  process.exit(1);
});