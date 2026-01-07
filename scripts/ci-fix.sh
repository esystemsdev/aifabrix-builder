#!/bin/bash
# CI Fix Script Wrapper
# This script is a wrapper that calls the actual CI fix script
# located in tests/scripts/ci-fix.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTUAL_SCRIPT="$SCRIPT_DIR/../tests/scripts/ci-fix.sh"

if [ ! -f "$ACTUAL_SCRIPT" ]; then
  echo "Error: CI fix script not found at $ACTUAL_SCRIPT" >&2
  exit 1
fi

# Make sure the script is executable
chmod +x "$ACTUAL_SCRIPT" 2>/dev/null || true

# Execute the actual script
exec "$ACTUAL_SCRIPT" "$@"

