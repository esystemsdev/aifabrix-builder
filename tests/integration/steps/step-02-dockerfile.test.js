/**
 * Integration Step 02: Generate Dockerfile
 * Tests aifabrix dockerfile command
 *
 * @fileoverview Integration test for Dockerfile generation
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
  getLanguagePort,
  getLanguageDockerfilePattern
} = require('../utils/integration-utils');

describe('Integration Step 02: Generate Dockerfile', () => {
  const language = process.env.TEST_LANGUAGE || 'python';
  const appName = getLanguageAppName(language);
  const port = getLanguagePort(language);

  it('should generate Dockerfile with correct base image', async() => {
    // Verify app exists (prerequisite check)
    const appInfo = await testAppExists(appName);
    if (!appInfo.builder) {
      throw new Error(`Prerequisite failed: Application not found. Run step-01-create.test.js first. App: ${appName}`);
    }

    // Generate Dockerfile
    console.log('Generating Dockerfile...');

    const result = await execCommand(`aifabrix dockerfile ${appName}`, 30000);

    if (result.exitCode !== 0) {
      throw new Error(`Dockerfile generation failed: ${result.stderr}`);
    }

    // Verify Dockerfile exists
    const dockerfile = path.join(appInfo.builderPath, 'Dockerfile');
    const dockerfileExists = await testFileExists(dockerfile);

    if (!dockerfileExists) {
      throw new Error('Dockerfile not generated');
    }
    expect(dockerfileExists).toBe(true);

    // Verify Dockerfile content based on language
    const dockerfileContent = await fs.readFile(dockerfile, 'utf8');
    const dockerfilePattern = getLanguageDockerfilePattern(language);

    if (!dockerfileContent.includes(dockerfilePattern)) {
      throw new Error(`Dockerfile does not contain expected base image pattern: ${dockerfilePattern}`);
    }
    expect(dockerfileContent).toContain(dockerfilePattern);
  });
});

