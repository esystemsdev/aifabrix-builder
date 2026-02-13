/**
 * Integration Step 01: Create Application
 * Tests aifabrix create command with --app flag
 *
 * @fileoverview Integration test for application creation
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
  getLanguageFiles,
  cleanupApp
} = require('../utils/integration-utils');

describe('Integration Step 01: Create Application', () => {
  const language = process.env.TEST_LANGUAGE || 'python';
  const appName = getLanguageAppName(language);
  const port = getLanguagePort(language);

  // Increase timeout for this test suite (application creation can take time)
  jest.setTimeout(300000); // 5 minutes

  beforeAll(async() => {
    // Cleanup existing app if it exists
    await cleanupApp(appName);
  });

  it('should create application with scaffolded configuration files', async() => {
    // Create application
    const languageDisplay = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
    console.log(`Creating ${languageDisplay} application...`);

    // Pipe "N" to answer "No" to GitHub Actions prompt
    const result = await execCommand(
      `printf "N\\n" | aifabrix create ${appName} --port ${port} --database --redis --storage --authentication --language ${language} --app`,
      60000
    );

    if (result.exitCode !== 0) {
      const errorMsg = result.stderr || result.stdout || 'Unknown error';
      throw new Error(`Application creation failed (exit code: ${result.exitCode}): ${errorMsg}`);
    }

    // Verify builder directory
    const appInfo = await testAppExists(appName);
    if (!appInfo.builder) {
      throw new Error('Application directory not created in builder/');
    }
    expect(appInfo.builder).toBe(true);

    // Verify apps directory
    if (!appInfo.apps) {
      throw new Error('Application directory not created in apps/');
    }
    expect(appInfo.apps).toBe(true);

    // Verify application files based on language
    const languageFiles = getLanguageFiles(language);
    for (const fileName of languageFiles.sourceFileNames) {
      const filePath = path.join(appInfo.appsPath, fileName);
      const exists = await testFileExists(filePath);
      if (!exists) {
        throw new Error(`${fileName} not found in apps/${appName}/`);
      }
      expect(exists).toBe(true);
    }

    // Verify application.yaml
    const variablesYaml = path.join(appInfo.builderPath, 'application.yaml');
    const variablesExists = await testFileExists(variablesYaml);
    if (!variablesExists) {
      throw new Error('application.yaml not found');
    }
    expect(variablesExists).toBe(true);
  });
});

