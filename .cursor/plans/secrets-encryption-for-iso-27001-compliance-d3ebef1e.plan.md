<!-- d3ebef1e-b192-40b5-a2a5-7a7811977b0d 3b9c5e8b-bb17-4e36-8a33-3365de9dedf8 -->
# Preserve Comments and Skip URLs in Secure Command

## Problem

The `aifabrix secure` command currently uses `yaml.load()` and `yaml.dump()` which removes all comments and formatting from secrets.local.yaml files. This is unacceptable as users may have important comments documenting their secrets. Additionally, URL values (http:// and https://) should not be encrypted as they are not secrets.

## Solution

Replace the YAML load/dump approach with line-by-line parsing that:

1. Preserves all comments, blank lines, and formatting
2. Only encrypts values that need encryption (skip URLs and already encrypted values)
3. Keeps the original file structure intact

## Implementation Plan

### 1. Create line-by-line YAML parser utility

**File**: `lib/utils/yaml-preserve.js` (new)

- Implement `encryptYamlValues(content, encryptionKey)` function
- Parse file line-by-line
- Identify key-value pairs using regex pattern
- Check if value needs encryption:
  - Not already encrypted (doesn't start with `secure://`)
  - Is a string (not boolean, number, null)
  - Not empty/whitespace
  - Doesn't start with `http://` or `https://` (URLs are not secrets)
- Encrypt values in place while preserving:
  - Indentation
  - Comments (both inline and block)
  - Blank lines
  - Key order
  - Special YAML formatting (quotes, multiline strings, etc.)

### 2. Update encryptSecretsFile function

**File**: `lib/commands/secure.js`

- Replace `yaml.load()` / `yaml.dump()` approach
- Use new `encryptYamlValues()` function
- Still validate that file contains valid YAML structure (optional validation)
- Preserve original file content structure

### 3. Handle edge cases

- Multiline YAML values (using `|` or `>`)
- Quoted strings (single, double, literal) - preserve quotes
- Inline comments after values
- Block comments
- Empty values
- Null values
- Boolean values
- URL values (http:// and https://) - skip encryption
- Values with leading/trailing whitespace in quotes

### 4. Testing

**File**: `tests/lib/utils/yaml-preserve.test.js` (new)

- Test comment preservation (inline and block)
- Test blank line preservation
- Test indentation preservation
- Test multiline values
- Test quoted strings
- Test already encrypted values (skip)
- Test URL values (http:// and https://) - should NOT be encrypted
- Test various YAML formats

**File**: `tests/lib/commands/secure.test.js` (update)

- Add tests for comment preservation
- Add tests for formatting preservation
- Add tests for URL values (should not be encrypted)
- Verify encrypted values are correct

## Key Implementation Details

### Line-by-line parsing pattern

```javascript
// Pattern to match key-value pairs with optional comments
// Matches: indentation, key, colon, value, optional whitespace, optional comment
const kvPattern = /^(\s*)([^#:\n]+?):\s*(.+?)(\s*)(#.*)?$/;

// For each line:
// - If matches pattern: check if value needs encryption
// - If already encrypted (starts with secure://): skip
// - If starts with http:// or https://: skip (URLs are not secrets)
// - If needs encryption: replace value with encrypted version
// - Preserve indentation, comments, and formatting
```

### Value detection logic

1. Check if value is a string (not boolean, number, null)
2. Check if value is not empty/whitespace
3. Check if value doesn't already start with `secure://`
4. Check if value doesn't start with `http://` or `https://` (URLs are not secrets)
5. Handle quoted strings (preserve quotes when encrypting)

### Comment preservation

- Inline comments: `key: value # comment` → `key: secure://... # comment`
- Block comments: `# comment line` → preserve as-is
- Empty lines: preserve as-is
- All formatting: preserve exactly as original

## Files to Modify/Create

**New Files:**

- `lib/utils/yaml-preserve.js` - Line-by-line YAML encryption with comment preservation
- `tests/lib/utils/yaml-preserve.test.js` - Tests for YAML preservation

**Modified Files:**

- `lib/commands/secure.js` - Update `encryptSecretsFile()` to use new approach
- `tests/lib/commands/secure.test.js` - Add comment preservation and URL exclusion tests

### To-dos

- [ ] Create lib/utils/yaml-preserve.js with encryptYamlValues() function for line-by-line parsing that preserves comments and skips URLs
- [ ] Update lib/commands/secure.js encryptSecretsFile() to use yaml-preserve utility instead of yaml.load/dump
- [ ] Create tests/lib/utils/yaml-preserve.test.js with comprehensive tests for comment preservation and URL exclusion
- [ ] Update tests/lib/commands/secure.test.js to verify comment preservation and URL exclusion