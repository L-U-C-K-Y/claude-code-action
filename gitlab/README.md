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

## What's New

### Recent Updates

- **MCP Support**: Claude can now update comments in real-time with progress
- **Smart Reply System**: Claude replies to existing comment threads instead of creating new comments
- **Tool Configuration**: Control which tools Claude can access
- **Better Context**: Claude sees all comments (triggers, context, resolved) for better understanding
- **Environment Integration**: Uses GitLab CI environment variables automatically

### How It Works

1. **Trigger Detection**: When someone mentions `@claude`, the integration checks if Claude has already responded
2. **Smart Replies**: Claude replies within the same discussion thread for better conversation flow
3. **Progress Updates**: Using MCP, Claude can update its comment with real-time progress
4. **Append Updates**: Final results are appended to the initial comment with timestamps

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
  - remote: 'https://raw.githubusercontent.com/YOUR_USERNAME/claude-code-action/main/gitlab/templates/claude-code.yml'
```

That's it! Claude will now respond to:

- Comments containing `@claude` in MRs or issues
- Assignment to `claude-bot` user
- Adding the `claude` label

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

Claude will:
1. Analyze the issue
2. Create a new branch
3. Implement the fix
4. Create a merge request

## Supported Triggers

1. **Comment Trigger**: Any comment with the trigger phrase
2. **Assignment Trigger**: Assign `claude-bot` to an MR
3. **Label Trigger**: Add `claude` label to MR or issue
4. **Manual Trigger**: Run the `claude-manual` job

## Examples

See the [examples](examples/) directory for:
- [Basic configuration](examples/basic.gitlab-ci.yml)
- [Advanced configuration](examples/advanced.gitlab-ci.yml)

## Development

To use a local development version instead of the published package:

```yaml
.claude-base:
  before_script:
    # ... other setup ...
    # Install from local directory instead of npm
    - npm install -g /builds/$CI_PROJECT_PATH/gitlab
```

## Troubleshooting

### Claude doesn't respond to triggers

1. Check that `CLAUDE_BOT_TOKEN` has correct permissions
2. Verify the trigger phrase matches your configuration
3. Check the pipeline logs for errors

### Permission errors

Ensure the bot token has:

- Access to the project (Developer role or higher)
- `api` and `write_repository` scopes

### No changes are pushed

1. Check that the branch protection rules allow the bot to push
2. Verify git is configured correctly in the pipeline

## Security

- Store tokens as masked CI/CD variables
- Use protected variables for sensitive projects
- Regularly rotate access tokens
- Review Claude's suggestions before merging

## Contributing

This is part of the [Claude Code Action](https://github.com/anthropics/claude-code-action) project. Contributions welcome!

## License

MIT License - see the parent repository for details.