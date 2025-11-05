/**
 * Integration Step 03: Resolve Secrets
 * Tests aifabrix resolve command with and without --force
 *
 * @fileoverview Integration test for secret resolution
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const {
  execCommand,
  testAppExists,
  testFileExists,
  getLanguageAppName,
  getLanguagePort
} = require('../utils/integration-utils');

describe('Integration Step 03: Resolve Secrets', () => {
  const language = process.env.TEST_LANGUAGE || 'python';
  const appName = getLanguageAppName(language);
  const port = getLanguagePort(language);

  it('should resolve secrets with --force flag', async() => {
    // Verify app exists (prerequisite check)
    const appInfo = await testAppExists(appName);
    if (!appInfo.builder) {
      throw new Error(`Prerequisite failed: Application not found. Run step-01-create.test.js first. App: ${appName}`);
    }

    // Test resolve without --force (may fail gracefully)
    console.log('Testing resolve without --force...');
    const resultWithoutForce = await execCommand(`aifabrix resolve ${appName}`, 30000);
    if (resultWithoutForce.exitCode !== 0) {
      console.warn('Resolve without --force failed (expected if secrets missing)');
    } else {
      console.log('Resolve without --force succeeded');
    }

    // Test resolve with --force
    console.log('Testing resolve with --force...');
    const result = await execCommand(`aifabrix resolve ${appName} --force`, 30000);

    if (result.exitCode !== 0) {
      throw new Error(`Resolve with --force failed: ${result.stderr}`);
    }

    // Verify .env file in builder
    const envFile = path.join(appInfo.builderPath, '.env');
    const envExists = await testFileExists(envFile);

    if (!envExists) {
      throw new Error('.env file not generated in builder/');
    }
    expect(envExists).toBe(true);

    // Verify .env file in apps (if envOutputPath is set)
    const appsEnvFile = path.join(appInfo.appsPath, '.env');
    const appsEnvExists = await testFileExists(appsEnvFile);
    if (appsEnvExists) {
      console.log('.env file copied to apps/');
    } else {
      console.warn('.env file not copied to apps/ (may not be configured)');
    }

    // Verify .env file contains database variables
    const envContent = await fs.readFile(envFile, 'utf8');
    if (!envContent.includes('DB_HOST')) {
      throw new Error('.env file does not contain DB_HOST');
    }
    expect(envContent).toContain('DB_HOST');
  });
});

