# validate-implementation

This command validates that a plan has been implemented correctly according to its requirements, verifies tests exist, and ensures no code violations of cursor rules.

## Purpose

The command:
1. Analyzes a plan file (from `.cursor/plans/`) to extract implementation requirements
2. Validates that all tasks are completed
3. Verifies that all mentioned files exist and are implemented
4. Checks that tests exist for new/modified code
5. Runs code quality validation (format → lint → test)
6. Validates against cursor rules
7. Generates a comprehensive validation report

## Usage

Run this command in chat with `/validate-implementation [plan-file-path]`

**Examples**:
- `/validate-implementation` - Validates the most recently modified plan file
- `/validate-implementation .cursor/plans/68-pipeline-actions-config-refactoring.plan.md` - Validates a specific plan

## What It Does

### 1. Plan Analysis

**Extracts from Plan File**:
- All tasks with checkboxes (`- [ ]` or `- [x]`)
- All files mentioned (paths, new files, modified files)
- All services, models, schemas, routes mentioned
- Test requirements (unit tests, integration tests)
- Database migration requirements
- Documentation requirements

**Validates Task Completion**:
- Checks if all tasks are marked as complete (`- [x]`)
- Identifies incomplete tasks (`- [ ]`)
- Reports completion percentage

### 2. File Existence Validation

**Checks for**:
- All mentioned files exist at specified paths
- New files are created (if marked as "New" in plan)
- Modified files exist and contain expected changes
- Database migrations exist (if mentioned)
- Schema files exist (if mentioned)
- Test files exist for new/modified code

**Validates File Content**:
- Checks if mentioned classes/functions exist in files
- Verifies expected imports are present
- Validates that key changes are implemented

### 3. Test Coverage Validation

**Checks for**:
- Unit test files exist for new services/modules
- Integration test files exist (if required by plan)
- Test structure mirrors code structure
- Test files are in correct locations (`tests/` mirrors `lib/`)

**Validates Test Quality**:
- Tests use proper fixtures and mocks
- Tests cover error cases
- Tests use async patterns where needed
- Tests follow cursor rules for testing

### 4. Code Quality Validation

**Runs Validation Steps (MANDATORY ORDER)**:

1. **STEP 1 - FORMAT**:
   - Run `npm run lint:fix` FIRST
   - Verify exit code 0
   - Report any formatting issues

2. **STEP 2 - LINT**:
   - Run `npm run lint` AFTER format
   - Verify exit code 0
   - Report all linting errors/warnings
   - **CRITICAL**: Zero warnings/errors required

3. **STEP 3 - TEST**:
   - Run `npm test` AFTER lint
   - Verify all tests pass
   - Report test failures
   - Check test execution time (< 0.5 seconds for unit tests)

**Validates Code Against Cursor Rules**:
- Reads relevant rules from `.cursor/rules/`
- Checks for violations in:
  - Code reuse (no duplication, use utilities)
  - Error handling (proper Error usage, try-catch)
  - Logging (logger utility, no console.log)
  - Type safety (JSDoc comments, type annotations)
  - Async patterns (async/await, fs.promises)
  - File operations (path.join, proper encoding)
  - Input validation (parameter validation, app name validation)
  - Module patterns (CommonJS, proper exports)
  - Security (no hardcoded secrets, proper secret management)

### 5. Implementation Completeness Check

**Validates**:
- All database schema changes are implemented
- All service methods are implemented
- All API endpoints are implemented
- All schemas are updated
- All migrations are created
- All documentation is updated

### 6. Report Generation

**Creates Validation Report**:
- Location: `.cursor/plans/<plan-name>-VALIDATION-REPORT.md`
- Contains:
  - Executive summary (overall status)
  - Task completion status
  - File existence validation results
  - Test coverage analysis
  - Code quality validation results
  - Cursor rules compliance check
  - Implementation completeness assessment
  - Issues and recommendations
  - Final validation checklist

## Output

### Validation Report Structure

```markdown
# <Plan Name> - Validation Report

**Date**: [Generated date]
**Plan**: [Plan file path]
**Status**: ✅ COMPLETE / ⚠️ INCOMPLETE / ❌ FAILED

## Executive Summary
[Overall status and completion percentage]

## Task Completion
- Total tasks: [number]
- Completed: [number]
- Incomplete: [number]
- Completion: [percentage]%

### Incomplete Tasks
- [List of incomplete tasks]

## File Existence Validation
- ✅/❌ [File path] - [Status]
- ✅/❌ [File path] - [Status]

## Test Coverage
- ✅/❌ Unit tests exist
- ✅/❌ Integration tests exist
- Test coverage: [percentage]%

## Code Quality Validation
- ✅/❌ Format: PASSED
- ✅/❌ Lint: PASSED (0 errors, 0 warnings)
- ✅/❌ Tests: PASSED (all tests pass)

## Cursor Rules Compliance
- ✅/❌ Code reuse: PASSED
- ✅/❌ Error handling: PASSED
- ✅/❌ Logging: PASSED
- ✅/❌ Type safety: PASSED
- ✅/❌ Async patterns: PASSED
- ✅/❌ File operations: PASSED
- ✅/❌ Input validation: PASSED
- ✅/❌ Module patterns: PASSED
- ✅/❌ Security: PASSED

## Implementation Completeness
- ✅/❌ Database schema: COMPLETE
- ✅/❌ Services: COMPLETE
- ✅/❌ API endpoints: COMPLETE
- ✅/❌ Schemas: COMPLETE
- ✅/❌ Migrations: COMPLETE
- ✅/❌ Documentation: COMPLETE

## Issues and Recommendations
[List of issues found and recommendations]

## Final Validation Checklist
- [x] All tasks completed
- [x] All files exist
- [x] Tests exist and pass
- [x] Code quality validation passes
- [x] Cursor rules compliance verified
- [x] Implementation complete
```

## Execution Behavior

**Automatic Execution**:
- The command executes automatically without asking for user input
- Shows progress during validation
- Reports results in the validation report
- Only asks for user input if critical issues require confirmation

**Error Handling**:
- If format fails: Reports error, does not proceed to lint
- If lint fails: Reports all errors, does not proceed to tests
- If tests fail: Reports all failures
- If files are missing: Reports missing files
- If tasks are incomplete: Reports incomplete tasks

**Critical Requirements**:
- **Format must pass** before linting
- **Lint must pass** (zero errors/warnings) before testing
- **Tests must pass** before marking as complete
- **All tasks must be completed** for full validation
- **All files must exist** for full validation
- **Tests must exist** for new/modified code

## Notes

- **Plan File Detection**: If no plan file is specified, the command finds the most recently modified plan file in `.cursor/plans/`
- **Task Parsing**: Extracts tasks from markdown checkboxes (`- [ ]` or `- [x]`)
- **File Detection**: Identifies file paths mentioned in plan (code blocks, file references, paths in text)
- **Test Detection**: Looks for test files in `tests/` directory that mirror `lib/` structure
- **Rule Validation**: Reads rules from `.cursor/rules/project-rules.mdc`
- **Report Location**: Validation reports are saved in `.cursor/plans/` with suffix `-VALIDATION-REPORT.md`

## Integration with Plans

This command is designed to be added to every code plan as a final validation step:

```markdown
## Validation

After implementation, run:
/validate-implementation .cursor/plans/<plan-name>.plan.md

This will validate:
- All tasks are completed
- All files exist and are implemented
- Tests exist and pass
- Code quality validation passes
- Cursor rules compliance verified
```

## Example Usage in Plan

```markdown
# Example Plan

## Tasks
- [ ] Task 1: Create service
- [ ] Task 2: Add tests
- [ ] Task 3: Update documentation

## Validation

After completing all tasks, run:
/validate-implementation .cursor/plans/example-plan.plan.md

This will generate a validation report confirming all requirements are met.
```

