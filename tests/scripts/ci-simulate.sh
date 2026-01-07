#!/bin/bash
# CI Simulation Script
# This script simulates the GitHub CI environment to catch issues before deployment

# Don't use set -e - we want to capture all results even if some steps fail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# If script is in tests/scripts/, go up two levels to get project root
# If script is in scripts/, go up one level to get project root
if [[ "$SCRIPT_DIR" == *"/tests/scripts" ]]; then
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
else
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
TEMP_DIR=$(mktemp -d)
TEST_PROJECT_DIR="$TEMP_DIR/aifabrix-builder-test"
REPORT_FILE="$TEMP_DIR/test-report.txt"
FAILED_TESTS_FILE="$TEMP_DIR/failed-tests.txt"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}CI Environment Simulation${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "Project Root: $PROJECT_ROOT"
echo "Temp Directory: $TEMP_DIR"
echo "Test Project: $TEST_PROJECT_DIR"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

# Step 1: Copy project to temp directory
echo -e "${YELLOW}[1/5] Copying project to temp directory...${NC}"
cd "$PROJECT_ROOT"
cp -r . "$TEST_PROJECT_DIR/" 2>/dev/null || {
    # If cp fails, try with find and exclude patterns
    find . -type f -not -path '*/node_modules/*' \
           -not -path '*/.git/*' \
           -not -path '*/coverage/*' \
           -not -path '*/.cursor/*' \
           -not -path '*/temp/*' \
           -not -name '*.log' \
           -exec install -D {} "$TEST_PROJECT_DIR/{}" \;
}

# Remove excluded directories if they were copied
cd "$TEST_PROJECT_DIR"
rm -rf node_modules .git coverage .cursor temp 2>/dev/null || true

if [ ! -f "$TEST_PROJECT_DIR/package.json" ]; then
    echo -e "${RED}✗ Failed to copy project${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Project copied${NC}"
echo ""

# Step 2: Install dependencies (like CI does)
echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
cd "$TEST_PROJECT_DIR"
npm ci --silent

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Run linting
echo -e "${YELLOW}[3/5] Running linting...${NC}"
LINT_EXIT=0
npm run lint > "$TEMP_DIR/lint-output.txt" 2>&1 || LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
    echo -e "${RED}✗ Linting failed${NC}"
    # Show first few lines of lint errors
    head -20 "$TEMP_DIR/lint-output.txt"
    echo ""
else
    echo -e "${GREEN}✓ Linting passed${NC}"
fi
echo ""

# Step 4: Run tests
echo -e "${YELLOW}[4/5] Running tests...${NC}"
echo "  (This may take a few minutes...)"
# Use a longer timeout for CI simulation (15 minutes to be safe)
# Capture both stdout and stderr
TEST_EXIT=0
timeout 900 npm test > "$REPORT_FILE" 2>&1 || {
  TIMEOUT_EXIT=$?
  if [ $TIMEOUT_EXIT -eq 124 ]; then
    TEST_EXIT=1
    echo "Tests timed out after 15 minutes" >> "$REPORT_FILE"
  else
    TEST_EXIT=$TIMEOUT_EXIT
  fi
}

# Extract test results
if [ $TEST_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed${NC}"
    TEST_SUMMARY=$(grep -E "(Test Suites|Tests:)" "$REPORT_FILE" | tail -2)
    echo "$TEST_SUMMARY"
else
    echo -e "${RED}✗ Tests failed${NC}"
    
    # Extract failed test information
    echo ""
    echo -e "${YELLOW}Failed Test Summary:${NC}"
    grep -E "FAIL|●" "$REPORT_FILE" | head -30
    
    # Save detailed failure info
    grep -A 20 "FAIL\|●" "$REPORT_FILE" > "$FAILED_TESTS_FILE"
    
    # Extract specific error patterns
    echo ""
    echo -e "${YELLOW}Common Error Patterns:${NC}"
    if grep -q ".env file not found" "$REPORT_FILE"; then
        echo -e "${RED}  - .env file not found errors detected${NC}"
    fi
    if grep -q "Docker Compose template not found" "$REPORT_FILE"; then
        echo -e "${RED}  - Template not found errors detected${NC}"
    fi
    if grep -q "Missing required password variable" "$REPORT_FILE"; then
        echo -e "${RED}  - Missing password variable errors detected${NC}"
    fi
fi
echo ""

# Step 5: Generate report
echo -e "${YELLOW}[5/5] Generating report...${NC}"
REPORT_SUMMARY="$TEMP_DIR/report-summary.txt"

cat > "$REPORT_SUMMARY" << EOF
========================================
CI Simulation Report
========================================
Date: $(date)
Project: aifabrix-builder
Test Directory: $TEST_PROJECT_DIR

LINTING:
$(if [ $LINT_EXIT -eq 0 ]; then echo "  ✓ PASSED"; else echo "  ✗ FAILED"; fi)

TESTING:
$(if [ $TEST_EXIT -eq 0 ]; then echo "  ✓ PASSED"; else echo "  ✗ FAILED"; fi)

TEST SUMMARY:
$(grep -E "(Test Suites|Tests:)" "$REPORT_FILE" | tail -2 || echo "  No summary available")

FAILED TESTS:
$(if [ $TEST_EXIT -ne 0 ]; then
    grep -E "FAIL|●" "$REPORT_FILE" | head -20
else
    echo "  None"
fi)

FULL REPORT:
  Lint: $TEMP_DIR/lint-output.txt
  Tests: $REPORT_FILE
  Failed Details: $FAILED_TESTS_FILE
========================================
EOF

cat "$REPORT_SUMMARY"
echo ""

# Copy report files to project temp directory for easy access
mkdir -p "$PROJECT_ROOT/temp/ci-reports"
cp "$REPORT_SUMMARY" "$PROJECT_ROOT/temp/ci-reports/last-run-summary.txt"
cp "$REPORT_FILE" "$PROJECT_ROOT/temp/ci-reports/last-run-tests.txt"
cp "$FAILED_TESTS_FILE" "$PROJECT_ROOT/temp/ci-reports/last-run-failures.txt" 2>/dev/null || true

echo -e "${GREEN}Reports saved to: $PROJECT_ROOT/temp/ci-reports/${NC}"
echo ""

# Exit with appropriate code
if [ $LINT_EXIT -ne 0 ] || [ $TEST_EXIT -ne 0 ]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}CI Simulation FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
else
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}CI Simulation PASSED${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
fi

