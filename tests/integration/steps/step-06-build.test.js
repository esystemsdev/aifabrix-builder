/**
 * Integration Step 06: Build Docker Image
 * Tests aifabrix build command
 *
 * @fileoverview Integration test for Docker image build
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  execCommand,
  testAppExists,
  testDockerRunning,
  getLanguageAppName,
  getLanguagePort
} = require('../utils/integration-utils');

describe('Integration Step 06: Build Docker Image', () => {
  const language = process.env.TEST_LANGUAGE || 'python';
  const appName = getLanguageAppName(language);
  const port = getLanguagePort(language);

  it('should build Docker image successfully', async() => {
    // Verify app exists (prerequisite check)
    const appInfo = await testAppExists(appName);
    if (!appInfo.builder) {
      throw new Error(`Prerequisite failed: Application not found. Run step-01-create.test.js first. App: ${appName}`);
    }

    // Check Docker is running
    const dockerRunning = await testDockerRunning();
    if (!dockerRunning) {
      throw new Error('Docker is not running. Please start Docker Desktop and try again.\n' +
        'Docker must be running for integration tests to build images.');
    }

    // Build Docker image
    console.log('Building Docker image...');
    const result = await execCommand(`aifabrix build ${appName}`, 300000); // 5 minute timeout for builds

    if (result.exitCode !== 0) {
      // Log the full output for debugging
      console.error('=== BUILD COMMAND DEBUG ===');
      console.error('Exit code:', result.exitCode);
      console.error('STDOUT:', result.stdout);
      console.error('STDERR:', result.stderr);
      console.error('==========================');

      // Check if it's actually a Docker daemon issue
      const errorText = (result.stderr || '') + (result.stdout || '');
      if (errorText.includes('Cannot connect to the Docker daemon') ||
          errorText.includes('Is the docker daemon running') ||
          errorText.includes('docker: command not found')) {
        throw new Error('Docker daemon is not accessible. Please ensure Docker Desktop is running and try again.');
      }

      throw new Error(`Docker build failed: ${result.stderr || result.stdout || 'Unknown error'}`);
    }

    // Verify image exists
    const imageCheck = await execCommand(`docker images --filter "reference=${appName}:latest" --format "{{.Repository}}:{{.Tag}}"`, 10000);
    if (!imageCheck.stdout.includes(`${appName}:latest`)) {
      throw new Error('Docker image not found');
    }

    expect(imageCheck.stdout).toContain(`${appName}:latest`);
  });
});

