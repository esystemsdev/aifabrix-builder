#!/bin/bash
# CI Fix Script
# This script runs CI simulation and attempts to fix common issues automatically

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# If script is in tests/scripts/, go up two levels to get project root
# If script is in scripts/, go up one level to get project root
if [[ "$SCRIPT_DIR" == *"/tests/scripts" ]]; then
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
else
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}CI Auto-Fix Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

MAX_ITERATIONS=5
ITERATION=1

while [ $ITERATION -le $MAX_ITERATIONS ]; do
    echo -e "${YELLOW}Iteration $ITERATION of $MAX_ITERATIONS${NC}"
    echo ""
    
    # Run CI simulation
    echo -e "${YELLOW}Running CI simulation...${NC}"
    # Call ci-simulate.sh - it will handle its own path resolution
    if "$SCRIPT_DIR/ci-simulate.sh"; then
        echo ""
        echo -e "${GREEN}✓ All checks passed!${NC}"
        exit 0
    fi
    
    # Check for specific errors and apply fixes
    FAILED_TESTS_FILE="$PROJECT_ROOT/temp/ci-reports/last-run-failures.txt"
    
    if [ ! -f "$FAILED_TESTS_FILE" ]; then
        echo -e "${RED}No failure details found. Manual intervention required.${NC}"
        exit 1
    fi
    
    FIXES_APPLIED=0
    
    # Fix 1: .env file not found errors
    if grep -q ".env file not found" "$FAILED_TESTS_FILE"; then
        echo -e "${YELLOW}Detected .env file not found errors${NC}"
        echo -e "${BLUE}Applying fix: Ensuring dev directory creation in tests...${NC}"
        
        # This would need to be implemented as a Node.js script or sed/awk
        # For now, we'll just report it
        echo -e "${YELLOW}  → Manual fix required: Update tests to ensure devDir exists${NC}"
        FIXES_APPLIED=1
    fi
    
    # Fix 2: Template not found errors
    if grep -q "Docker Compose template not found" "$FAILED_TESTS_FILE"; then
        echo -e "${YELLOW}Detected template not found errors${NC}"
        echo -e "${BLUE}Applying fix: Ensuring template mocking in tests...${NC}"
        
        # This would need to be implemented as a Node.js script or sed/awk
        echo -e "${YELLOW}  → Manual fix required: Update tests to mock templates properly${NC}"
        FIXES_APPLIED=1
    fi
    
    # Fix 3: Missing password variable errors (when .env exists but password missing)
    if grep -q "Missing required password variable" "$FAILED_TESTS_FILE" && ! grep -q ".env file not found" "$FAILED_TESTS_FILE"; then
        echo -e "${YELLOW}Detected missing password variable errors${NC}"
        echo -e "${BLUE}This is expected behavior - test is working correctly${NC}"
    fi
    
    if [ $FIXES_APPLIED -eq 0 ]; then
        echo -e "${RED}No automatic fixes available. Manual intervention required.${NC}"
        echo ""
        echo -e "${YELLOW}Failed test details:${NC}"
        head -50 "$FAILED_TESTS_FILE"
        exit 1
    fi
    
    ITERATION=$((ITERATION + 1))
    echo ""
    echo -e "${YELLOW}Waiting before next iteration...${NC}"
    sleep 2
    echo ""
done

echo -e "${RED}Maximum iterations reached. Manual intervention required.${NC}"
exit 1

