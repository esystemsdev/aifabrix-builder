# Update .env File on Token Registration/Rotation

## Problem

When tokens are registered or rotated, the `env.template` file is updated with new credentials, but the actual `.env` file is not regenerated. This means the application doesn't get the updated credentials until the `.env` file is manually regenerated.

## Solution

After updating `env.template` in both registration and rotation flows, we need to also regenerate the `.env` file by calling `generateEnvFile`.

## Changes Required

### 1. Update `lib/app-register.js`

- Import `generateEnvFile` from `lib/secrets.js`
- After `updateEnvTemplate` is called (line 444), add a call to `generateEnvFile` to regenerate the `.env` file
- Use environment 'local' since this is for localhost scenarios
- Add error handling and logging
- Update success message to indicate `.env` file was updated

### 2. Update `lib/app-rotate-secret.js`

- Import `generateEnvFile` from `lib/secrets.js`
- After `updateEnvTemplate` is called (line 149), add a call to `generateEnvFile` to regenerate the `.env` file
- Use environment 'local' since this is for localhost scenarios
- Add error handling and logging
- Update success message to indicate `.env` file was updated

### 3. Add Tests

- Update `tests/lib/app-register.test.js` to verify `.env` file is generated/updated after registration
- Update `tests/lib/commands-app-actions-rotate.test.js` to verify `.env` file is generated/updated after rotation
- Mock `generateEnvFile` and verify it's called with correct parameters
- Verify the `.env` file contains the updated credentials

## Implementation Details

### File: `lib/app-register.js`

- Add import: `const { generateEnvFile } = require('./secrets');`
- After line 444 (updateEnvTemplate call), add:
  ```javascript
  // Regenerate .env file with updated credentials
  try {
    await generateEnvFile(registeredAppKey, null, 'local');
    logger.log(chalk.green('✓ .env file updated with new credentials'));
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Could not regenerate .env file: ${error.message}`));
  }
  ```


### File: `lib/app-rotate-secret.js`

- Add import: `const { generateEnvFile } = require('./secrets');`
- After line 149 (updateEnvTemplate call), add:
  ```javascript
  // Regenerate .env file with updated credentials
  try {
    await generateEnvFile(appKey, null, 'local');
    logger.log(chalk.green('✓ .env file updated with new credentials'));
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Could not regenerate .env file: ${error.message}`));
  }
  ```


### Test Updates

- Mock `generateEnvFile` in test files
- Verify it's called with correct app name and environment
- Verify `.env` file content contains updated credentials (if testing file content)

## Notes

- The `.env` file regeneration should only happen when `isLocalhost` is true (same condition as `updateEnvTemplate`)
- Use environment 'local' for local development scenarios
- Error handling should be graceful - if `.env` regeneration fails, log a warning but don't fail the entire operation
- The existing `updateEnvTemplate` functionality remains unchanged

## Implementation Todos

1. **update-app-register**: Update `lib/app-register.js` to call `generateEnvFile` after `updateEnvTemplate` to regenerate `.env` file
2. **update-app-rotate-secret**: Update `lib/app-rotate-secret.js` to call `generateEnvFile` after `updateEnvTemplate` to regenerate `.env` file
3. **test-app-register**: Add tests to verify `.env` file is updated after registration in `tests/lib/app-register.test.js`
4. **test-app-rotate-secret**: Add tests to verify `.env` file is updated after rotation in `tests/lib/commands-app-actions-rotate.test.js`