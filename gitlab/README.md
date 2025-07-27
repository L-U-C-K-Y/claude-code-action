# Claude Code for GitLab

Integrate Claude AI into your GitLab workflow for automated code reviews, test generation, bug fixes, and more.

## Features

- 🤖 **AI Code Reviews**: Get intelligent feedback on merge requests
- 🧪 **Test Generation**: Automatically generate tests for your code
- 🐛 **Bug Fixes**: Let Claude analyze and fix issues
- 📝 **Documentation**: Generate or improve code documentation
- 🔄 **Direct Integration**: Works within GitLab CI/CD pipelines

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

## Configuration

You can customize Claude's behavior by setting these variables in your `.gitlab-ci.yml`:

```yaml
variables:
  CLAUDE_TRIGGER_PHRASE: "@ai"          # Change trigger phrase
  CLAUDE_BRANCH_PREFIX: "ai/"           # Change branch prefix
  CLAUDE_MODEL: "claude-3-opus-20240229" # Use different model
  CLAUDE_TIMEOUT_MINUTES: "60"          # Increase timeout
  CLAUDE_MAX_TURNS: "50"                # Allow more interactions
```

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