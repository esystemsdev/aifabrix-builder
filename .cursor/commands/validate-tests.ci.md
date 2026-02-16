# validate-tests-ci

When the `/validate-tests-ci` command is used, the agent must run CI test validation to ensure all tests pass in a clean CI-like environment. This command focuses specifically on GitHub CI testing validation by running the CI simulation script.

**Execution Process:**

1. **CI Simulation**:
   - Run `pnpm test:ci` to execute the CI simulation script
   - This simulates the GitHub CI environment by:
     - Copying the project to a temporary directory
     - Installing dependencies with `npm ci`
     - Running linting
     - Running all tests (excluding local tests)
   - Wait for completion and capture results

2. **Result Analysis**:
   - Check if CI simulation passed or failed
   - If failed, analyze the failure report:
     - Read `/workspace/aifabrix-builder/temp/ci-reports/last-run-summary.txt`
     - Read `/workspace/aifabrix-builder/temp/ci-reports/last-run-failures.txt`
     - Identify which tests failed and why
   - Report the status clearly to the user

3. **Failure Handling**:
   - If tests fail, provide a summary of:
     - Which test suites failed
     - Common error patterns detected
     - Specific failure reasons
   - Do NOT attempt to fix failures automatically unless explicitly requested
   - Provide actionable information about what needs to be fixed

4. **Success Confirmation**:
   - If all tests pass, confirm that the codebase is ready for CI
   - Report test statistics (test suites passed, total tests passed)
   - Indicate that the code will pass GitHub Actions CI

**Important Notes:**

- This command runs tests in a clean environment similar to GitHub CI
- Local tests in `tests/local/` are automatically excluded in CI environments (see `jest.config.js` when `INCLUDE_LOCAL_TESTS` is not `'true'`). This includes complex tests such as `app-coverage-uncovered.test.js` that rely on temp-dir and path resolution and are kept out of CI scope.
- The CI simulation may take several minutes to complete
- Test results are saved to `temp/ci-reports/` for review
- This validation is more strict than local testing and catches environment-specific issues

**Expected Output:**

```
✓ Linting passed
✓ All tests passed
Test Suites: 181 passed, 181 total
Tests: 3978 passed
```

Or if failures occur:

```
✗ Tests failed
Failed Test Summary:
FAIL tests/lib/some-test.test.js
  ● Test description
    Error message
```

**Usage:**

The user can invoke this command to validate that their changes will pass GitHub CI before pushing or creating a pull request. This helps catch issues early and ensures CI builds succeed.
