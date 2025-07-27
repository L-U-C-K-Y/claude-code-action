#!/bin/bash
# Add headers to upstream files to track their origin

echo "📝 Adding headers to upstream files..."

for file in src/upstream/*.ts; do
  if [[ -f "$file" && "$file" != *"actions-core-shim.ts" ]]; then
    filename=$(basename "$file")
    
    # Create temporary file with header
    cat > "$file.tmp" << EOF
/**
 * Copied from: base-action/src/$filename
 * 
 * This file is copied from the upstream base-action directory.
 * Modifications:
 * - Updated imports to use local paths
 * - Changed @actions/core to use actions-core-shim
 * - Updated RUNNER_TEMP to fallback to /tmp
 */

EOF
    
    # Append original content
    cat "$file" >> "$file.tmp"
    
    # Replace original file
    mv "$file.tmp" "$file"
    
    echo "✅ Added header to $filename"
  fi
done

echo "📋 Done! Headers added to track file origins."