# Claude Code for GitLab

Integrate Claude AI into your GitLab workflow for automated code reviews, test generation, bug fixes, and more.

## Features

- 🤖 **AI Code Reviews**: Get intelligent feedback on merge requests
- 🧪 **Test Generation**: Automatically generate tests for your code
- 🐛 **Bug Fixes**: Let Claude analyze and fix issues
- 📝 **Documentation**: Generate or improve code documentation
- 🔄 **Direct Integration**: Works within GitLab CI/CD pipelines
- 💬 **Real-time Updates**: Claude updates comments with progress using MCP
- 🔧 **Configurable Tools**: Control which tools Claude can use
- 🎯 **Smart Replies**: Claude replies to existing comment threads
- 🌿 **Automatic Git Workflow**: Claude creates branches, commits, and can create MRs automatically
- 🔐 **Secure**: Uses GitLab's native authentication and permissions

## What's New in v1.0.0

### Major Improvements

- **Simplified Template**: Single manual job for all use cases
- **MCP Support**: Real-time comment updates with progress tracking
- **Smart Reply System**: Claude replies in existing discussion threads
- **Duplicate Prevention**: Avoids responding to already-answered questions
- **Git Push Options**: Automatic MR creation with proper metadata
- **Better Context**: Shows trigger comments, context, and previous Claude replies

### Architecture

The integration consists of:

1. **GitLab CI Template** (`templates/claude-code.yml`): Single manual job configuration
2. **Main Runner** (`src/main.ts`): Orchestrates the Claude integration
3. **GitLab API Wrapper** (`src/api.ts`): Handles all GitLab interactions
4. **MCP Comment Server** (`src/mcp/gitlab-comment-server.ts`): Enables real-time updates
5. **Context Parser** (`src/context.ts`): Extracts GitLab CI environment information
6. **Prompt Formatter** (`src/formatter.ts`): Creates context-rich prompts for Claude

## Quick Start

### 1. Create a GitLab Bot User

1. Create a new GitLab user called `claude-bot`
2. Generate a Personal Access Token with scopes:
   - `api`
   - `write_repository`

### 2. Add CI/CD Variables

In your project settings (Settings → CI/CD → Variables), add:

- `CLAUDE_BOT_TOKEN`: The GitLab PAT from step 1
- `ANTHROPIC_API_KEY`: Your Anthropic API key (or use `CLAUDE_CODE_OAUTH_TOKEN` for Claude Pro/Teams subscriptions)

### 3. Update Your `.gitlab-ci.yml`

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/anthropics/claude-code-action/main/gitlab/templates/claude-code.yml'
```

### 4. Run Claude

1. Add a comment with `@claude` in a merge request or issue
2. Go to the pipeline that was created
3. Manually trigger the `claude` job
4. Claude will analyze the context and respond in the discussion thread

## Configuration

You can customize Claude's behavior using CI/CD variables:

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `CLAUDE_BOT_TOKEN` | Yes | GitLab PAT with api and write_repository scopes | - |
| `ANTHROPIC_API_KEY` | Yes* | Your Anthropic API key | - |
| `CLAUDE_CODE_OAUTH_TOKEN` | Yes* | Claude Pro/Teams OAuth token | - |
| `CLAUDE_TRIGGER_PHRASE` | No | Phrase to trigger Claude | `@claude` |
| `CLAUDE_BRANCH_PREFIX` | No | Prefix for branches Claude creates | `claude/` |
| `CLAUDE_MODEL` | No | Claude model to use | Latest |
| `CLAUDE_TIMEOUT_MINUTES` | No | Timeout for Claude execution | `30` |
| `CLAUDE_MAX_TURNS` | No | Maximum conversation turns | `25` |
| `CLAUDE_ALLOWED_TOOLS` | No | Comma-separated list of allowed tools | See below |
| `CLAUDE_DISALLOWED_TOOLS` | No | Comma-separated list of disallowed tools | `WebSearch,WebFetch` |
| `CLAUDE_ADDITIONAL_MCP_CONFIG` | No | JSON string with additional MCP server configurations | - |

*Either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` is required

### Tool Configuration

Claude has access to various tools for interacting with your codebase. Default allowed tools:

- `Edit`, `MultiEdit` - Edit files
- `Glob`, `Grep`, `LS`, `Read` - Search and read files
- `Write` - Create new files
- `Bash` - Run shell commands
- `TodoWrite` - Track tasks
- `mcp__gitlab_comment__update_claude_comment` - Update the GitLab comment with progress

You can customize which tools are available:

```yaml
variables:
  CLAUDE_ALLOWED_TOOLS: "Read,Edit,Grep"  # Only allow reading and basic editing
  CLAUDE_DISALLOWED_TOOLS: "Bash,Write"   # Prevent running commands and creating files
```

### MCP (Model Context Protocol) Support

The integration includes an MCP server that allows Claude to update comments in real-time. This provides better progress tracking and user feedback.

You can also add your own MCP servers:

```yaml
variables:
  CLAUDE_ADDITIONAL_MCP_CONFIG: |
    {
      "mcpServers": {
        "my_custom_server": {
          "command": "python",
          "args": ["/path/to/my/server.py"],
          "env": {
            "API_KEY": "$MY_API_KEY"
          }
        }
      }
    }
```

### Environment Variables

The integration automatically uses GitLab CI environment variables:

- `CI_PROJECT_ID`, `CI_PROJECT_PATH`, `CI_PROJECT_URL` - Project information
- `CI_MERGE_REQUEST_IID`, `CI_ISSUE_IID` - MR/Issue identification
- `CI_API_V4_URL` - GitLab instance API URL (self-hosted support)
- `CI_DEFAULT_BRANCH`, `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` - Branch information
- `CI_JOB_ID`, `CI_JOB_URL`, `CI_PIPELINE_ID` - CI/CD context

## Usage Examples

### In Merge Requests

```
@claude Can you review this code for potential security issues?
```

```
@claude Please add unit tests for the new calculateTotal function
```

### In Issues

```
@claude I'm getting a null pointer exception in the user service. Can you help fix it?
```

### Claude's Workflow

When triggered, Claude will:

1. **Analyze** the request and context
2. **Create a new branch** with a descriptive name
3. **Make changes** to implement the requested fixes or features
4. **Commit** with conventional commit messages
5. **Push** with automatic MR creation using git push options
6. **Update** the comment with the MR link and summary

### Git Push Options

Claude uses GitLab's push options for automatic MR creation:

```bash
git push -o merge_request.create \
         -o merge_request.target=main \
         -o merge_request.title="fix: resolve null pointer exception" \
         -o merge_request.description="Fixes #123" \
         -o merge_request.remove_source_branch \
         origin fix/issue-123-null-pointer
```

## Examples

See the [examples](examples/) directory for:
- [Basic configuration](examples/basic.gitlab-ci.yml) - Simple setup with custom trigger phrase
- [Advanced configuration](examples/advanced.gitlab-ci.yml) - Complex setup with conditional triggers

### Minimal Example

```yaml
# .gitlab-ci.yml
include:
  - remote: 'https://raw.githubusercontent.com/anthropics/claude-code-action/main/gitlab/templates/claude-code.yml'

# That's all you need! The template provides everything else.
```

## How the Integration Works

### 1. Trigger Detection
- When a pipeline runs, the integration checks for `@claude` mentions
- It identifies which comments are new vs already answered
- Prevents duplicate responses by tracking Claude's previous replies

### 2. Context Gathering
- Fetches the full MR/issue details
- Categorizes comments into:
  - **Trigger comments**: New mentions of `@claude`
  - **Context comments**: Other unresolved discussions
  - **Claude replies**: Previous responses for continuity

### 3. Claude Execution
- Creates a comprehensive prompt with all context
- Enforces git workflow rules via system prompt
- Provides real-time updates via MCP

### 4. Git Workflow
- Always creates new branches (never commits to existing ones)
- Uses conventional commit format
- Automatically creates MRs with proper metadata

## Troubleshooting

### Claude doesn't respond to triggers

1. **Check the manual job**: Remember, the `claude` job must be manually triggered
2. **Verify tokens**: Ensure `CLAUDE_BOT_TOKEN` and `ANTHROPIC_API_KEY` are set
3. **Check permissions**: Bot user needs Developer access or higher
4. **Review logs**: Check the job logs in `claude-*.log` artifacts

### Permission errors

Ensure the bot token has:
- Access to the project (Developer role or higher)
- `api` and `write_repository` scopes
- Ability to create branches and MRs

### No changes are pushed

1. **Branch protection**: Check rules allow the bot to push
2. **Git configuration**: Verify git user/email is set correctly
3. **Token permissions**: Ensure `write_repository` scope is enabled

### Claude responds multiple times

This should not happen with v1.0.0+ due to duplicate prevention. If it does:
1. Check that you're using the latest template
2. Verify the integration is checking `hasClaudeReply` properly
3. Review the logs for trigger detection issues

## Security

- Store tokens as masked CI/CD variables
- Use protected variables for sensitive projects
- Regularly rotate access tokens
- Review Claude's suggestions before merging

## Development

### Running Locally

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run the integration locally (requires GitLab env vars)
bun run src/main.ts
```

### Project Structure

```text
gitlab/
├── src/
│   ├── main.ts              # Entry point
│   ├── api.ts               # GitLab API wrapper
│   ├── context.ts           # CI environment parser
│   ├── formatter.ts         # Prompt formatting
│   ├── install-mcp-server.ts # MCP configuration
│   └── mcp/
│       └── gitlab-comment-server.ts # MCP server for updates
├── templates/
│   └── claude-code.yml      # GitLab CI template
├── examples/                # Usage examples
└── test/                    # Test files
```

### Key Components

1. **Trigger Detection**: Smart detection prevents duplicate responses
2. **Comment Threading**: Replies maintain discussion context
3. **MCP Integration**: Real-time progress updates
4. **Git Automation**: Enforced workflow with automatic MR creation

## Contributing

This is part of the [Claude Code Action](https://github.com/anthropics/claude-code-action) project. Contributions welcome!

### Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

MIT License - see the parent repository for details.
