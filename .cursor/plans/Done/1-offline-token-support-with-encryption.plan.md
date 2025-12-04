<!-- 98313f08-33f9-429a-b6b2-49dd60a8f407 31ad7e64-bb4d-430d-be7b-87681d009b47 -->
# Offline Token Support with Encryption

## Overview

Implement OAuth2 offline token support using Keycloak's `offline_access` scope via an optional `scope` parameter in Device Code Flow, and encrypt stored tokens in `config.yaml`. This will eliminate the need to login every 30 minutes while maintaining ISO 27001 security compliance.

## Implementation Plan

### 1. Add Optional Scope Parameter to Device Code Flow

**File**: `lib/utils/device-code.js`

- Modify `initiateDeviceCodeFlow(controllerUrl, environment, scope)` to accept optional `scope` parameter
- Default to `'openid profile email'` when no scope is provided (backward compatibility)
- When `offline_access` is requested, include it in the scope string (e.g., `'openid profile email offline_access'`)
- Update API call to `/api/v1/auth/login` to include scope parameter in request body or query string
- Pass scope through to Keycloak via the endpoint

**File**: `lib/commands/login.js`

- Update `handleDeviceCodeLogin()` to accept optional `scope` parameter from options
- Pass scope to `initiateDeviceCodeFlow()` (default: `'openid profile email'`, with `--offline`: add `offline_access`)
- Update CLI command definition to add `--offline` flag for convenience

**File**: `lib/cli.js`

- Add `--offline` flag to login command (adds `offline_access` to scope)
- Add `--scope <scopes>` option for custom scope specification
- When `--offline` is used, automatically add `offline_access` to the default scope

### 2. Add Optional Scope Parameter to Client Credentials Flow

**File**: `lib/commands/login.js`

- Modify `handleCredentialsLogin()` to accept optional `scope` parameter
- Default to no scope (or empty) for backward compatibility
- When `offline_access` is requested, include it in the scope
- Update API call to `/api/v1/auth/token` to include scope in request body or headers
- Handle offline token response (refresh token that doesn't expire)
- Update CLI command to add `--offline` flag for credentials method

### 3. Create Token Encryption Utilities

**File**: `lib/utils/token-encryption.js` (new)

- Create encryption/decryption functions for tokens using existing `secrets-encryption.js` utilities
- Reuse AES-256-GCM encryption from secrets encryption
- Functions:
- `encryptToken(value, key)` - Encrypt token value
- `decryptToken(encryptedValue, key)` - Decrypt token value
- `isTokenEncrypted(value)` - Check if token is encrypted
- Use same encryption key from `config.yaml` (`secrets-encryption` key)

### 4. Update Config Module for Token Encryption

**File**: `lib/config.js`

- Modify `saveDeviceToken()` to encrypt tokens before saving
- Modify `saveClientToken()` to encrypt tokens before saving
- Modify `getDeviceToken()` to decrypt tokens when reading
- Modify `getClientToken()` to decrypt tokens when reading
- Handle missing encryption key gracefully (fallback to plain text for backward compatibility)
- Add helper functions:
- `encryptTokenValue(value)` - Encrypt using key from config
- `decryptTokenValue(value)` - Decrypt using key from config

### 5. Update Token Manager for Encrypted Tokens

**File**: `lib/utils/token-manager.js`

- Ensure `getOrRefreshDeviceToken()` handles encrypted tokens
- Ensure `getOrRefreshClientToken()` handles encrypted tokens
- Update refresh logic to work with encrypted tokens
- No changes needed if config.js handles decryption transparently

### 6. Handle Token Migration

**File**: `lib/config.js`

- Add migration logic to encrypt existing plain-text tokens on first read
- Detect unencrypted tokens and encrypt them automatically
- Preserve backward compatibility with existing plain-text tokens

### 7. Update Documentation

**File**: `docs/CLI-REFERENCE.md`

- Document `--offline` flag and `--scope` option in login command
- Explain offline token support and scope parameter
- Explain that tokens are encrypted at rest
- Update authentication section

**File**: `docs/CONFIGURATION.md`

- Document token encryption in config.yaml structure
- Explain offline token behavior
- Document scope parameter default behavior
- Update security section

### 8. Add Tests

**File**: `tests/lib/utils/token-encryption.test.js` (new)

- Test encryption/decryption functions
- Test with same key as secrets encryption
- Test error handling

**File**: `tests/lib/config.test.js`

- Update tests to handle encrypted tokens
- Test token encryption/decryption in save/get operations
- Test migration from plain text to encrypted

**File**: `tests/lib/commands-login.test.js`

- Test scope parameter in device flow (default and custom)
- Test `--offline` flag behavior
- Test offline token request in credentials flow
- Test encrypted token storage

**File**: `tests/lib/utils/device-code.test.js`

- Test scope parameter in `initiateDeviceCodeFlow()`
- Test default scope behavior
- Test offline_access scope handling

## Technical Details

### Offline Token Request

- Device Code Flow: 
- Add optional `scope` parameter to `initiateDeviceCodeFlow(controllerUrl, environment, scope)`
- Default scope: `'openid profile email'` (backward compatible)
- With `--offline` flag: `'openid profile email offline_access'`
- Pass scope to `/api/v1/auth/login` endpoint (query param or body)
- Client Credentials Flow:
- Add optional `scope` parameter to `handleCredentialsLogin()`
- Default: no scope (backward compatible)
- With `--offline` flag: `'offline_access'`
- Pass scope to `/api/v1/auth/token` request body or headers

### Token Encryption

- Use same encryption key as secrets (`secrets-encryption` in config.yaml)
- Encrypt both access tokens and refresh tokens
- Store encrypted tokens with `secure://` prefix (same format as encrypted secrets)
- Decrypt transparently when reading from config

### Backward Compatibility

- Support reading plain-text tokens (for existing configs)
- Auto-encrypt plain-text tokens on first access
- Graceful fallback if encryption key is missing
- Default scope maintains existing behavior

## Security Considerations

- Tokens encrypted at rest using AES-256-GCM
- Same encryption key infrastructure as secrets
- No plain-text tokens stored after migration
- Encryption key stored in config.yaml (user must secure this file)

## Files to Modify

1. `lib/utils/device-code.js` - Add optional scope parameter with default `'openid profile email'`
2. `lib/commands/login.js` - Add `--offline` flag and `--scope` option for device flow only
3. `lib/cli.js` - Add `--offline` and `--scope` options to login command
4. `lib/utils/token-encryption.js` - New file for token encryption utilities
5. `lib/config.js` - Encrypt/decrypt tokens in save/get operations
6. `lib/utils/token-manager.js` - Ensure compatibility with encrypted tokens
7. `docs/CLI-REFERENCE.md` - Update documentation with new options
8. `docs/CONFIGURATION.md` - Update documentation
9. `tests/lib/utils/token-encryption.test.js` - New test file
10. `tests/lib/config.test.js` - Update tests
11. `tests/lib/commands-login.test.js` - Update tests for scope parameter
12. `tests/lib/utils/device-code.test.js` - Update tests for scope parameter

### To-dos

- [ ] Add offline_access scope to device code flow in lib/utils/device-code.js
- [ ] Add offline_access scope to client credentials flow in lib/commands/login.js
- [ ] Create lib/utils/token-encryption.js with encryption/decryption utilities
- [ ] Update lib/config.js to encrypt/decrypt tokens in save/get operations
- [ ] Ensure lib/utils/token-manager.js works with encrypted tokens
- [ ] Add migration logic to encrypt existing plain-text tokens
- [ ] Update CLI-REFERENCE.md and CONFIGURATION.md with offline token and encryption info
- [ ] Add tests for token encryption and offline token support