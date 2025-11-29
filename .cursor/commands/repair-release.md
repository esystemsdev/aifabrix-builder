# repair-release

When the `/repair-release` command is used, the agent must automatically prepare the component for release by running validation, analyzing changes, updating the changelog, and incrementing the version number. The agent must work autonomously without asking the user for input.

**Execution Process:**

1. **Validation Step**:
   - First, run the `/validate-tests` command to ensure all tests pass, linting is clean, and the codebase is in a validated state
   - This includes: `npm run lint:fix`, `npm run lint`, `npm test`, and final verification
   - Do not proceed until all validation steps pass

2. **Change Detection Step**:
   - Get the last deployed version from git tags (e.g., `v2.7.0`)
   - Compare current HEAD with the last tag to detect what has changed
   - Analyze git commit messages and file changes to categorize changes:
     - **New Features**: New CLI commands, new modules, new functionality (minor version bump: 2.x.0)
     - **Bug Fixes**: Fixes, patches, corrections (patch version bump: 2.0.x)
   - Use git commands to get:
     - Commit messages since last tag: `git log <last-tag>..HEAD --oneline`
     - Changed files: `git diff <last-tag>..HEAD --name-status`
     - Summary of changes for changelog

3. **Version Determination Step**:
   - Read current version from `package.json` (e.g., `2.7.0`)
   - Determine version increment based on change analysis:
     - **Patch increment** (2.7.0 → 2.7.1): If only bug fixes, small corrections, or minor changes
     - **Minor increment** (2.7.0 → 2.8.0): If new features, new commands, new modules, or significant functionality added
   - Calculate new version number

4. **Changelog Update Step**:
   - Read `CHANGELOG.md` to understand the format
   - Extract changes from git commits since last tag
   - Categorize changes into sections:
     - `### Added` - New features, commands, modules
     - `### Changed` - Modifications to existing functionality
     - `### Fixed` - Bug fixes and corrections
     - `### Technical` - Technical details, dependencies, architecture changes
   - Add new version entry at the top of CHANGELOG.md with:
     - Version number in format: `## [X.Y.Z] - YYYY-MM-DD`
     - Date in format: YYYY-MM-DD (current date)
     - Categorized changes from git analysis
   - Follow the existing changelog format and style

5. **Version Update Step**:
   - Update `package.json` with the new version number
   - Replace the `version` field in package.json with the calculated new version
   - Ensure JSON formatting is preserved

6. **Final Verification Step**:
   - Verify package.json version was updated correctly
   - Verify CHANGELOG.md was updated with new entry
   - Verify changelog entry follows the correct format
   - Display summary of changes made

**Critical Requirements:**

- **Automatic Execution**: The agent MUST automatically execute all steps without user interaction
- **Validation First**: Always run `/validate-tests` first to ensure codebase is ready for release
- **Change Analysis**: Properly analyze git changes to determine version increment type
- **Changelog Format**: Follow the exact format used in existing CHANGELOG.md entries
- **Version Semantics**:
  - Patch (2.7.0 → 2.7.1): Bug fixes, small corrections, patches
  - Minor (2.7.0 → 2.8.0): New features, new commands, new modules, significant functionality
- **Date Format**: Use YYYY-MM-DD format for changelog dates
- **Git Tag Detection**: Use `git tag --sort=-version:refname` to find the latest version tag
- **Change Extraction**: Extract meaningful change descriptions from git commits
- **No User Input**: Work autonomously and only report completion when all steps are done

**Version Bump Rules:**

- **Patch Version (2.7.0 → 2.7.1)**: Use when changes include:
  - Bug fixes
  - Security patches
  - Small corrections
  - Documentation updates (if only docs)
  - Code quality improvements (refactoring, linting fixes)
  - Performance optimizations (without new features)

- **Minor Version (2.7.0 → 2.8.0)**: Use when changes include:
  - New CLI commands
  - New modules or utilities
  - New features or functionality
  - New configuration options
  - Breaking changes (should be rare, but if they occur, use minor version)
  - Significant enhancements to existing features

**Work is only complete when:**
- ✅ All validation tests pass (via `/validate-tests`)
- ✅ Changes have been analyzed from git
- ✅ Version number has been determined and incremented
- ✅ CHANGELOG.md has been updated with new version entry
- ✅ package.json version has been updated
- ✅ All changes follow the project's format and standards
