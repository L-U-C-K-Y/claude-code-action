#!/bin/bash
# Update imports in copied upstream files

echo "🔄 Updating imports in upstream files..."

# Replace @actions/core imports with our shim
echo "Replacing @actions/core imports..."
find src/upstream -name "*.ts" -exec sed -i '' \
  's|import \* as core from "@actions/core"|import * as core from "./actions-core-shim"|g' {} \;

# Update any relative imports that might break
echo "Updating relative imports..."
find src/upstream -name "*.ts" -exec sed -i '' \
  's|from "\./|from "./upstream/|g' {} \;

# Update RUNNER_TEMP to use standard temp directory
echo "Updating RUNNER_TEMP references..."
find src/upstream -name "*.ts" -exec sed -i '' \
  's/process\.env\.RUNNER_TEMP/process.env.RUNNER_TEMP || "\/tmp"/g' {} \;

echo "✅ Imports updated!"

# Show what was changed
echo ""
echo "Changed files:"
find src/upstream -name "*.ts" -exec echo "  - {}" \;