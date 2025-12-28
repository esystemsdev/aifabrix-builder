# Add Logout Command

## Overview

Add a new `aifabrix logout` command that clears authentication tokens stored in `~/.aifabrix/config.yaml`. The command will support clearing all tokens or specific tokens based on options.

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Command patterns, user experience, error handling, and Commander.js usage. Applies because we're adding a new CLI command.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits (≤500 lines, ≤50 lines per function), documentation requirements, JSDoc comments. Mandatory for all plans.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit including build, lint, test, coverage requirements. Mandatory for all plans.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, mock patterns, test coverage (≥80%). Applies because we're adding comprehensive tests.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, logging standards, chalk for colored output. Applies because the command needs proper error handling.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - JavaScript conventions, async/await patterns, input validation, file operations. Applies to all code changes.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - Data protection, secret management, never log tokens/secrets. Applies because we're dealing with authentication tokens.
- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Module structure, CLI command pattern, file organization. Applies because we're adding a new command module.

**Key Requirements**:

- Use Commander.js pattern for command definition in `lib/cli.js`
- Add input validation and error handling with chalk for colored output
- Use try-catch for all async operations
- Write comprehensive tests with Jest (≥80% coverage)
- Add JSDoc comments for all public functions
- Keep files ≤500 lines and functions ≤50 lines
- Use `path.join()` for cross-platform paths
- Never log tokens or sensitive data (security requirement)
- Use `handleCommandError` utility for consistent error handling
- Follow existing command patterns from `lib/commands/login.js`
- Preserve config structure (only remove token entries)

## Before Development

- [ ] Read CLI Command Development section from project-rules.mdc
- [ ] Review existing CLI commands (`lib/commands/login.js`) for patterns
- [ ] Review error handling patterns and `handleCommandError` utility
- [ ] Understand testing requirements and Jest patterns
- [ ] Review JSDoc documentation patterns
- [ ] Review token management functions in `lib/utils/config-tokens.js`
- [ ] Review config structure in `lib/config.js`

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs lint + test:ci)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments with `@fileoverview`, `@author`, `@version`, parameter types, return types, and error conditions
7. **Code Quality**: All rule requirements met (input validation, error handling, async/await patterns)
8. **Security**: No hardcoded secrets, never log tokens, ISO 27001 compliance
9. **CLI Standards**: Command follows all standards from CLI Command Development section
10. **Test Coverage**: Tests have proper coverage (≥80%) with success and error paths
11. **Documentation**: CLI command documented in `docs/CLI-REFERENCE.md`
12. All tasks completed

## Implementation Details

### 1. Command Handler (`lib/commands/logout.js`)

Create a new command handler following the pattern from `lib/commands/login.js`:

- Function: `handleLogout(options)` - Main logout handler
- Options support:
- `--controller <url>` - Clear tokens for specific controller (device tokens only)
- `--environment <env>` - Clear tokens for specific environment (client tokens only)
- `--app <app>` - Clear tokens for specific app (requires --environment, client tokens only)
- No options: Clear all tokens (both device and client tokens)
- Clear device tokens from `config.device[controllerUrl]`
- Clear client tokens from `config.environments[env].clients[appName]`
- Preserve other config settings (developer-id, environment setting, secrets-encryption, etc.)
- Provide user-friendly success messages with chalk

### 2. CLI Registration (`lib/cli.js`)

Add logout command registration:

- Command: `logout`
- Description: "Clear authentication tokens"
- Options:
- `-c, --controller <url>` - Clear device tokens for specific controller
- `-e, --environment <env>` - Clear client tokens for specific environment
- `-a, --app <app>` - Clear client tokens for specific app (requires --environment)
- Action handler: Call `handleLogout` from `lib/commands/logout.js`
- Error handling: Use `handleCommandError` utility

### 3. Token Clearing Functions (`lib/config.js` or `lib/utils/config-tokens.js`)

Add functions to clear tokens (if not already present):

- `clearDeviceToken(controllerUrl)` - Clear device token for specific controller
- `clearAllDeviceTokens()` - Clear all device tokens
- `clearClientToken(environment, appName)` - Clear client token for specific environment/app
- `clearAllClientTokens()` - Clear all client tokens
- `clearClientTokensForEnvironment(environment)` - Clear all client tokens for an environment

These functions should:

- Load config using `getConfig()`
- Remove token entries while preserving other config structure
- Save config using `saveConfig()`
- Handle cases where tokens don't exist (no error, just skip)

### 4. Tests (`tests/lib/commands/logout.test.js`)

Create comprehensive test suite:

- Test clearing all tokens
- Test clearing device tokens by controller
- Test clearing client tokens by environment
- Test clearing client tokens by environment and app
- Test error handling (invalid options, missing config, etc.)
- Test that other config settings are preserved
- Mock `config` module functions
- Use Jest patterns from existing command tests

### 5. Documentation (`docs/CLI-REFERENCE.md`)

Add logout command documentation:

- Add to "Authentication & Setup" section
- Include usage examples
- Document all options
- Show output examples
- Explain what gets cleared vs preserved

## File Changes

### New Files

- `lib/commands/logout.js` - Logout command handler
- `tests/lib/commands/logout.test.js` - Logout command tests

### Modified Files

- `lib/cli.js` - Add logout command registration (after login command)
- `lib/utils/config-tokens.js` - Add token clearing functions (or add to `lib/config.js` if more appropriate)
- `docs/CLI-REFERENCE.md` - Add logout command documentation

## Implementation Notes

1. **Token Storage Structure**:

- Device tokens: `config.device[controllerUrl]` (root level)
- Client tokens: `config.environments[env].clients[appName]` (nested)

2. **Preserve Config**:

- Keep `developer-id`, `environment`, `secrets-encryption`, `aifabrix-secrets`, etc.
- Only remove token-related entries

3. **Validation**:

- If `--app` is provided, `--environment` must also be provided
- Validate controller URL format if provided
- Validate environment key format if provided

4. **User Feedback**:

- Show what was cleared (all tokens, specific controller, specific environment/app)
- Use chalk for colored output (green for success, gray for info)
- Show config file location: `~/.aifabrix/config.yaml`

5. **Error Handling**:

- Handle missing config file gracefully (no tokens to clear)
- Handle invalid options with clear error messages
- Use try-catch with proper error formatting

## Testing Strategy

- Unit tests for all clearing functions
- Integration tests for CLI command
- Test edge cases (no tokens, partial tokens, invalid options)
- Verify config preservation
- Test with encrypted tokens (if encryption key is set)
- Mock `config` module functions
- Test both success and error paths
- Achieve ≥80% test coverage for new code

## Plan Validation Report

**Date**: 2025-01-27
**Plan**: `.cursor/plans/19-add_logout_command.plan.md`
**Status**: ✅ VALIDATED

### Plan Purpose

**Summary**: Add a new `aifabrix logout` CLI command that clears authentication tokens from the config file. The command supports clearing all tokens or specific tokens based on options (controller, environment, app).

**Scope**: 
- CLI command development
- Configuration management (token clearing)
- Testing (comprehensive test suite)
- Documentation (CLI reference)

**Type**: Development (CLI command feature)

**Key Components**:
- `lib/commands/logout.js` - Command handler
- `lib/cli.js` - CLI registration
- `lib/utils/config-tokens.js` - Token clearing functions
- `tests/lib/commands/logout.test.js` - Test suite
- `docs/CLI-REFERENCE.md` - Documentation

### Applicable Rules

- ✅ **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Applies because we're adding a new CLI command. Requirements: Commander.js pattern, input validation, error handling, chalk for output, user-friendly messages.
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - Mandatory for all plans. Requirements: Files ≤500 lines, functions ≤50 lines, JSDoc for all public functions, documentation requirements.
- ✅ **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory for all plans. Requirements: Build, lint, test must pass, ≥80% coverage, file size limits, no hardcoded secrets.
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Applies because we're adding tests. Requirements: Jest framework, mock external dependencies, test success and error paths, ≥80% coverage.
- ✅ **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Applies because command needs error handling. Requirements: try-catch for async, meaningful error messages, chalk for colored output, never log secrets.
- ✅ **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - Applies to all code changes. Requirements: async/await, input validation, file operations with `fs.promises`, `path.join()` for paths.
- ✅ **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - Applies because we're dealing with authentication tokens. Requirements: Never log tokens/secrets, proper data protection, secure configuration management.
- ✅ **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Applies because we're adding a new command module. Requirements: Module structure, CLI command pattern, file organization, CommonJS exports.

### Rule Compliance

- ✅ **DoD Requirements**: Now documented with BUILD → LINT → TEST order, file size limits, JSDoc requirements, security requirements
- ✅ **CLI Command Development**: Plan addresses command pattern, error handling, user experience, chalk for output
- ✅ **Code Quality Standards**: Plan mentions file size limits, JSDoc requirements, documentation
- ✅ **Testing Conventions**: Plan includes comprehensive test strategy with Jest patterns
- ✅ **Error Handling**: Plan addresses error handling, try-catch, graceful error messages
- ✅ **Security & Compliance**: Plan addresses token handling, never logging secrets, preserving config structure
- ✅ **Architecture Patterns**: Plan follows existing command patterns and module structure

### Plan Updates Made

- ✅ Added **Rules and Standards** section with all applicable rule references and key requirements
- ✅ Added **Before Development** checklist with prerequisites and preparation steps
- ✅ Added **Definition of Done** section with complete DoD requirements including:
  - Build step (`npm run build` - runs FIRST, must succeed)
  - Lint step (`npm run lint` - must pass with zero errors)
  - Test step (`npm test` or `npm run test:ci` - must pass AFTER lint, ≥80% coverage)
  - Validation order (BUILD → LINT → TEST)
  - File size limits (≤500 lines, ≤50 lines per function)
  - JSDoc documentation requirements
  - Security requirements (no hardcoded secrets, never log tokens)
  - Code quality requirements
- ✅ Enhanced **Testing Strategy** section with coverage requirements and test patterns
- ✅ Added validation report to document compliance status

### Recommendations

- ✅ Plan is production-ready and compliant with all applicable rules
- ✅ All DoD requirements are documented
- ✅ All applicable rule sections are referenced
- ✅ Security considerations are addressed (token handling, no logging of secrets)
- ✅ Testing strategy is comprehensive with coverage requirements
- ✅ Implementation follows existing patterns from `lib/commands/login.js`

**Next Steps**: Plan is validated and ready for implementation. Follow the Definition of Done checklist when implementing.