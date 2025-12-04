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

    // Generate deployment key (this should generate JSON first, then extract key)
    console.log('Generating deployment key...');
    const result = await execCommand(`aifabrix genkey ${appName}`, 30000);

    if (result.exitCode !== 0) {
      throw new Error(`Deployment key generation failed: ${result.stderr}`);
    }

    expect(result.exitCode).toBe(0);

    // Verify that JSON file was generated (genkey command generates JSON first)
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(process.cwd(), 'builder', appName, `${appName}-deploy.json`);
    expect(fs.existsSync(jsonPath)).toBe(true);

    // Verify JSON contains deploymentKey
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const deployment = JSON.parse(jsonContent);
    expect(deployment.deploymentKey).toBeDefined();
    expect(deployment.deploymentKey).toMatch(/^[a-f0-9]{64}$/);

    // Verify output contains the key
    expect(result.stdout).toContain('Deployment key for');
    expect(result.stdout).toContain(deployment.deploymentKey);
  });
});

