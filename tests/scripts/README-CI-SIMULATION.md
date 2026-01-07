# CI Simulation Scripts

This directory contains scripts to simulate the GitHub CI environment locally, helping catch issues before deployment.

## Scripts

### `ci-simulate.sh`

Simulates the complete GitHub CI workflow:
1. Copies project to a temporary directory (excluding node_modules, .git, etc.)
2. Installs dependencies using `npm ci` (like CI does)
3. Runs linting
4. Runs tests
5. Generates a detailed report

**Usage:**
```bash
./scripts/ci-simulate.sh
```

**Output:**
- Console output with colored status messages
- Reports saved to `temp/ci-reports/`:
  - `last-run-summary.txt` - Summary of the run
  - `last-run-tests.txt` - Full test output
  - `last-run-failures.txt` - Detailed failure information

### `ci-fix.sh`

Attempts to automatically fix common CI issues (currently a placeholder for future auto-fix capabilities).

**Usage:**
```bash
./scripts/ci-fix.sh
```

## Why Use CI Simulation?

The CI simulation helps catch issues that only appear in clean environments:
- Path resolution differences
- Mock setup issues
- Environment variable differences
- Dependency installation issues
- Test isolation problems

## Common Issues Detected

1. **.env file not found errors** - Tests writing to wrong paths
2. **Template not found errors** - Template mocking issues
3. **Missing password variable errors** - Test setup problems

## Integration with Development Workflow

Run before committing:
```bash
./scripts/ci-simulate.sh
```

If it passes, your code should pass in GitHub CI as well.

