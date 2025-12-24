# validate-plan

Validate a plan file before execution by identifying its purpose, reading relevant rules, validating rule scope, updating the plan with rule references, and ensuring Definition of Done (DoD) requirements are documented.

## Purpose

This command ensures that:

1. Plans are validated against relevant rules before execution
2. Plan authors understand which rules apply to their plan
3. Plans include proper DoD requirements (build → lint → test)
4. Plans reference relevant rule files for guidance
5. Plans are production-ready before implementation begins

## Usage

```bash
/validate-plan [plan-file-path]
```

**Parameters**:

- `plan-file-path` (optional): Path to the plan file to validate. If not specified:
  - First checks if there's a current chat plan (from `mcp_create_plan` tool or recent conversation)
  - If no current plan, lists recent plans from `.cursor/plans/` and asks user to select
  - If still unclear, prompts user for clarification

**Examples**:

- `/validate-plan` - Validates current chat plan or prompts for plan selection
- `/validate-plan .cursor/plans/8-language-specific-env-variables.plan.md` - Validates a specific plan

## Execution Steps

### Step 1: Plan File Resolution

**Logic**:

1. If `plan-file-path` provided: Use that file directly
2. If empty: Check for current chat plan context
   - Look for plan file references in recent conversation messages
   - Check if `mcp_create_plan` was recently called (check conversation history)
   - If found, use that plan file path
3. If still empty: List recent plans from `.cursor/plans/` directory
   - Sort by modification time (most recent first)
   - Show last 5-10 plans with their titles
   - Ask user to select one or provide a path
4. If unclear: Ask user to specify the plan file path explicitly

**Implementation**:

- Read plan file from resolved path
- Validate file exists and is readable
- Parse markdown structure
- If file doesn't exist, report error and ask for correct path

### Step 2: Identify Plan Purpose

**Analysis**:

1. Read plan file content completely
2. Extract from plan:
   - **Title**: Main title from `# Title` (first H1)
   - **Overview**: Content from `## Overview` section
   - **Scope**: What areas are affected (CLI commands, templates, schemas, Docker, deployment, infrastructure, etc.)
   - **Key Components**: Files, modules, commands, templates mentioned in plan
   - **Type**: Classify as one of:
     - Architecture (structure, schema, design)
     - Development (CLI commands, features, modules)
     - Template (Handlebars templates, Dockerfiles)
     - Infrastructure (Docker Compose, deployment)
     - Refactoring (code improvements, restructuring)
     - Testing (test additions, test improvements)
     - Documentation (docs, guides)
     - Security (ISO 27001 compliance, secret management)

**Keywords to Detect**:

- **CLI/Commands**: "CLI", "command", "Commander.js", "bin/", "lib/cli.js"
- **Templates**: "template", "Handlebars", "Dockerfile", "env.template"
- **Schemas**: "schema", "validation", "AJV", "YAML", "JSON Schema"
- **Infrastructure**: "Docker", "docker-compose", "infrastructure", "deployment"
- **Security**: "ISO 27001", "secret", "kv://", "security", "compliance"
- **Architecture**: "architecture", "structure", "design", "pattern"

**Output**:

- Plan purpose summary (1-2 sentences)
- Affected areas list (CLI, templates, schemas, Docker, deployment, etc.)
- Plan type classification
- Key components mentioned

### Step 3: Read Rules and Identify Scope

**Rule File** (from `.cursor/rules/`):

- **`project-rules.mdc`** - Single comprehensive rule file containing:
  - Project Overview - Technologies and architecture
  - Architecture Patterns - Module structure, file organization, CLI patterns
  - Code Style - JavaScript conventions, naming, error handling
  - Testing Conventions - Jest patterns, test structure, coverage
  - Security & Compliance (ISO 27001) - Data protection, secret management, audit
  - Code Quality Standards - File size limits, documentation, JSDoc
  - Development Workflow - Pre/during/post development steps
  - CLI Command Development - Command patterns and user experience
  - Template Development - Handlebars templates, Dockerfiles
  - Validation Patterns - Schema validation, YAML validation
  - Docker & Infrastructure - Dockerfile generation, Docker Compose
  - Quality Gates - Mandatory checks before commit
  - Error Handling & Logging - Error patterns, logging standards
  - Dependencies & Security - Dependency management, security scanning

**Rule Mapping Logic**:

- **CLI/Command changes** → All sections (Architecture Patterns, CLI Command Development, Code Style, Testing)
- **Template changes** → Template Development, Validation Patterns, Docker & Infrastructure
- **Schema changes** → Validation Patterns, Architecture Patterns, Code Quality Standards
- **Docker/Infrastructure changes** → Docker & Infrastructure, Security & Compliance
- **Security changes** → Security & Compliance (ISO 27001), Secret Management
- **All plans** → Quality Gates (MANDATORY), Code Quality Standards (MANDATORY)

**Implementation**:

1. Read the rule file `.cursor/rules/project-rules.mdc` completely
2. Based on plan scope, identify relevant sections:
   - Keywords matching (e.g., plan mentions "CLI" → CLI Command Development section)
   - Component matching (e.g., plan mentions "template" → Template Development section)
   - Type matching (e.g., plan type is "Infrastructure" → Docker & Infrastructure section)
   - Always include Quality Gates and Code Quality Standards (mandatory)
3. For each applicable section, extract:
   - Section name
   - Why it applies (brief reason based on plan content)
   - Key requirements from section (read section and extract main points)

**Key Requirements Extraction**:

- Read each applicable section from the rule file
- Extract main requirements, checklists, critical policies
- Summarize in 2-3 bullet points per section
- Focus on actionable requirements

### Step 4: Validate Rule Compliance

**Validation Checks**:

1. **DoD Requirements** (from Quality Gates section):
   - ✅ Build step documented (`npm run build` - runs lint + test:ci)
   - ✅ Lint step documented (`npm run lint` - must run and pass with zero errors)
   - ✅ Test step documented (`npm test` or `npm run test:ci` - all tests must pass)
   - ✅ Validation order specified (BUILD → LINT → TEST)
   - ✅ Zero warnings/errors requirement mentioned
   - ✅ Mandatory sequence documented (never skip steps, build must succeed first)
   - ✅ Test coverage ≥80% requirement mentioned (for new code)

2. **Plan-Specific Rules**:
   - Check if plan addresses key requirements from applicable rule sections
   - Identify missing rule references in plan
   - Identify potential violations based on rule requirements
   - Check if plan mentions rule-specific patterns (e.g., JSDoc for functions, try-catch for async)

**Output**:

- List of applicable rule sections with compliance status
- Missing requirements checklist
- Recommendations for plan improvement

### Step 5: Update Plan with Rule References

**Plan Updates**:

1. **Add or update `## Rules and Standards` section**:
   - Reference the main rule file: `.cursor/rules/project-rules.mdc`
   - List all applicable sections with brief descriptions
   - Format: `- **[Section Name](.cursor/rules/project-rules.mdc#section-name)** - [Brief description]`
   - Explain why each section applies (1 sentence)
   - Add "Key Requirements" subsection with bullet points from each section

2. **Add or update `## Definition of Done` section**:
   - Build requirement: `npm run build` (must run FIRST, must succeed - runs lint + test:ci)
   - Lint requirement: `npm run lint` (must run and pass with zero errors/warnings)
   - Test requirement: `npm test` or `npm run test:ci` (must run AFTER lint, all tests must pass, ≥80% coverage for new code)
   - Validation order: BUILD → LINT → TEST (mandatory sequence, never skip steps)
   - File size limits: Files ≤500 lines, functions ≤50 lines
   - JSDoc documentation: All public functions must have JSDoc comments
   - Code quality: All rule requirements met
   - Security: No hardcoded secrets, ISO 27001 compliance
   - All tasks completed

3. **Add or update `## Before Development` section**:
   - Checklist of rule compliance items
   - Prerequisites from rules (e.g., "Read project-rules.mdc")
   - Validation requirements
   - Rule-specific preparation steps

**Update Strategy**:

- If section exists: Update/merge with new information (preserve existing content, add missing items)
- If section missing: Add new section at appropriate location (after Overview, before Tasks)
- Preserve existing content where possible
- Use consistent markdown formatting
- Add rule links using anchor links: `.cursor/rules/project-rules.mdc#section-name`

**Section Order** (if creating new sections):

1. Overview
2. Rules and Standards (add here)
3. Before Development (add here)
4. Definition of Done (add here)
5. Tasks/Implementation (existing)

### Step 6: Generate and Attach Validation Report

**Report Attachment**:

- Append the validation report directly to the plan file at the end
- Do not create separate validation documents
- Place the report after all existing plan content

**Report Structure**:

```markdown
## Plan Validation Report

**Date**: [YYYY-MM-DD]
**Plan**: [plan-file-path]
**Status**: ✅ VALIDATED / ⚠️ NEEDS UPDATES / ❌ INCOMPLETE

### Plan Purpose

[Summary of plan purpose, scope, and type]

### Applicable Rules

- ✅ [Section Name](.cursor/rules/project-rules.mdc#section-name) - [Why it applies]
- ✅ [Section Name](.cursor/rules/project-rules.mdc#section-name) - [Why it applies]
- ⚠️ [Section Name](.cursor/rules/project-rules.mdc#section-name) - [Why it applies] (missing from plan)

### Rule Compliance

- ✅ DoD Requirements: Documented
- ✅ [Section Name]: Compliant
- ⚠️ [Section Name]: Missing [requirement]

### Plan Updates Made

- ✅ Added Rules and Standards section
- ✅ Updated Definition of Done section
- ✅ Added Before Development checklist
- ✅ Added rule references: [list of sections added]

### Recommendations

- [List of recommendations for plan improvement]
- [Any missing requirements]
- [Any potential issues]
```

**Status Determination**:

- ✅ **VALIDATED**: All DoD requirements present, all applicable rules referenced, plan is production-ready
- ⚠️ **NEEDS UPDATES**: DoD requirements present but some rules missing or incomplete
- ❌ **INCOMPLETE**: Missing critical DoD requirements or major rule violations

**Report Attachment**:

- **Always append validation report to plan file**: The validation report is appended directly to the plan file at the end, after all existing content
- **No separate documents**: Validation reports are never created as separate files - they are always integrated into the plan file itself
- **Report placement**: Add the validation report section at the very end of the plan file, after all tasks and other sections

## Integration with Existing Commands

**Relationship to Other Commands**:

- **`/validate-code`**: Validates code after implementation (code quality, rule compliance)
- **`/validate-implementation`**: Validates plan execution (tasks completed, files exist, tests pass)
- **`/validate-plan`**: Validates plan before execution (rule compliance, DoD requirements) - **NEW**

**Workflow**:

1. Create plan → `/validate-plan` (validate plan structure and rule compliance)
2. Implement plan → Code changes
3. `/validate-code` (validate code quality and rule compliance)
4. `/validate-implementation` (validate plan completion and test coverage)

## DoD Requirements (Mandatory)

Every plan must include these requirements in the Definition of Done section:

1. **Build Step**: `npm run build` (must run FIRST, must complete successfully - runs lint + test:ci)
2. **Lint Step**: `npm run lint` (must run and pass with zero errors/warnings)
3. **Test Step**: `npm test` or `npm run test:ci` (must run AFTER lint, all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc Documentation**: All public functions must have JSDoc comments
7. **Code Quality**: Code quality validation passes
8. **Security**: No hardcoded secrets, ISO 27001 compliance
9. **Rule References**: Links to applicable sections from `.cursor/rules/project-rules.mdc`
10. **All Tasks Completed**: All plan tasks marked as complete

## Example Plan Updates

### Before Validation

```markdown
# Example Plan

## Overview

Create a new CLI command for app management.

## Tasks

- [ ] Create command
- [ ] Add tests
```

### After Validation

```markdown
# Example Plan

## Overview

Create a new CLI command for app management.

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Command patterns, user experience, and error handling
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, documentation, JSDoc requirements
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage requirements
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns and logging standards

**Key Requirements**:

- Use Commander.js pattern for command definition
- Add input validation and error handling with chalk for colored output
- Use try-catch for all async operations
- Write tests for the command with Jest
- Add JSDoc comments for all public functions
- Keep files ≤500 lines and functions ≤50 lines
- Use path.join() for cross-platform paths
- Never log secrets or sensitive data

## Before Development

- [ ] Read CLI Command Development section from project-rules.mdc
- [ ] Review existing CLI commands for patterns
- [ ] Review error handling patterns
- [ ] Understand testing requirements
- [ ] Review JSDoc documentation patterns

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs lint + test:ci)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets, ISO 27001 compliance
9. All tasks completed
10. CLI command follows all standards from CLI Command Development section
11. Tests have proper coverage (≥80%)

## Tasks

- [ ] Create command
- [ ] Add tests
- [ ] Run build → lint → test validation
```

## Success Criteria

- ✅ Plan purpose identified correctly
- ✅ Applicable rule sections identified and referenced
- ✅ DoD requirements documented
- ✅ Plan updated with rule references
- ✅ Validation report generated
- ✅ Plan ready for production implementation

## Notes

- **Rule Reading**: Always read the rule file completely to extract accurate requirements
- **Plan Preservation**: Preserve existing plan content when updating sections
- **Mandatory Sections**: Quality Gates and Code Quality Standards are mandatory for ALL plans
- **Rule Links**: Use anchor links for rule file sections (`.cursor/rules/project-rules.mdc#section-name`)
- **DoD Order**: Always document validation order as BUILD → LINT → TEST
- **Status**: Report status accurately based on compliance level
- **Project-Specific**: This is a CLI tool project, adapt scope detection accordingly
- **Report Attachment**: Validation reports are always appended to the plan file itself - never create separate validation documents

