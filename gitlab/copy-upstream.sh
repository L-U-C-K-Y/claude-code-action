#!/bin/bash
# Copy required files from upstream base-action to gitlab directory

echo "📋 Copying upstream files for GitLab integration..."

# Create directories if they don't exist
mkdir -p src/upstream

# Copy the files we need
echo "Copying validate-env.ts..."
cp ../base-action/src/validate-env.ts src/upstream/

echo "Copying run-claude.ts..."
cp ../base-action/src/run-claude.ts src/upstream/

echo "Copying prepare-prompt.ts..."
cp ../base-action/src/prepare-prompt.ts src/upstream/

# Also copy the types file if it exists
if [ -f "../base-action/src/types.ts" ]; then
    echo "Copying types.ts..."
    cp ../base-action/src/types.ts src/upstream/
fi

# Copy any other dependencies these files might have
echo "Checking for additional dependencies..."

# Copy setup-claude-code-settings.ts if referenced
if grep -q "setup-claude-code-settings" src/upstream/*.ts 2>/dev/null; then
    echo "Copying setup-claude-code-settings.ts..."
    cp ../base-action/src/setup-claude-code-settings.ts src/upstream/ 2>/dev/null || echo "  - Not found, skipping"
fi

echo "✅ Files copied to src/upstream/"
echo ""
echo "Now update your imports in main.ts to use './upstream/...' instead of '../../base-action/src/...'"