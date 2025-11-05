/**
 * Integration Step 05: Generate Deployment Key
 * Tests aifabrix genkey command
 *
 * @fileoverview Integration test for deployment key generation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  execCommand,
  testAppExists,
  getLanguageAppName,
  getLanguagePort
} = require('../utils/integration-utils');

describe('Integration Step 05: Generate Deployment Key', () => {
  const language = process.env.TEST_LANGUAGE || 'python';
  const appName = getLanguageAppName(language);
  const port = getLanguagePort(language);

  it('should generate deployment key', async() => {
    // Verify app exists (prerequisite check)
    const appInfo = await testAppExists(appName);
    if (!appInfo.builder) {
      throw new Error(`Prerequisite failed: Application not found. Run step-01-create.test.js first. App: ${appName}`);
    }

    // Generate deployment key
    console.log('Generating deployment key...');
    const result = await execCommand(`aifabrix genkey ${appName}`, 30000);

    if (result.exitCode !== 0) {
      throw new Error(`Deployment key generation failed: ${result.stderr}`);
    }

    expect(result.exitCode).toBe(0);
  });
});

