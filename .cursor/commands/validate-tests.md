# validate-tests

When the `/validate-tests` command is used, the agent must automatically fix all errors and ensure all validation steps pass. The agent must work autonomously without asking the user for input or showing intermediate progress.

**Execution Process:**

1. **Lint Fix Step**:
   - Run `npm run lint:fix` to automatically fix linting and formatting issues
   - If lint:fix fails or produces errors, automatically fix the issues in the codebase
   - Re-run `npm run lint:fix` until it passes (exit code 0)
   - Do not proceed until lint:fix step is green

2. **Lint Check Step**:
   - Run `npm run lint` to check for remaining linting errors
   - If linting fails, automatically fix all linting errors in the codebase
   - Re-run `npm run lint` until it passes (exit code 0)
   - Do not proceed until lint step is green

3. **Test Step**:
   - Run `npm test` to run all tests
   - If tests fail, automatically fix all test failures
   - Re-run `npm test` until all tests pass (exit code 0)
   - Do not proceed until test step is green
   - **All tests MUST be mocked** - no real database connections, external API calls, or I/O operations
   - **Test execution time MUST be less than 0.5 seconds** - if one test take longer, optimize by ensuring all external dependencies are properly mocked

4. **Final Verification Step**:
   - Run `npm run lint:fix` again to ensure no formatting changes were introduced
   - Run `npm run lint` again to ensure no linting issues were introduced
   - If lint:fix or lint made any changes, run `npm test` again to verify tests still pass
   - Continue this loop until lint:fix and lint make no changes AND tests pass
   - This ensures the codebase is in a stable, validated state

**Critical Requirements:**

- **Automatic Error Fixing**: The agent MUST automatically fix all errors found during validation
- **Iterative Process**: Keep running each step and fixing errors until it passes
- **No User Interaction**: Do NOT ask the user for input or show what's being done
- **Silent Operation**: Work autonomously and only report completion when all steps are green
- **Test Performance**: All tests must be mocked and complete in less than 0.5 seconds
- **Final Verification**: Lint:fix and lint must be run again after tests pass, and if changes are made, tests must be re-run
- **Complete Success**: The command is only complete when ALL steps pass AND final verification shows no changes:
  - ✅ `npm run lint:fix` passes (initial)
  - ✅ `npm run lint` passes (initial)
  - ✅ `npm test` passes (initial, < 0.5 seconds, all mocked)
  - ✅ `npm run lint:fix` passes (final, no changes)
  - ✅ `npm run lint` passes (final, no changes)
  - ✅ `npm test` passes (final, if lint:fix/lint made changes)

**Work is only done when all validation checks are green and working, final verification shows no changes, and all tests pass in under 0.5 seconds.**
