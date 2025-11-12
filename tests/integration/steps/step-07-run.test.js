/**
 * Integration Step 07: Run Docker Container
 * Tests aifabrix run command and validates docker-compose.yaml
 *
 * @fileoverview Integration test for running Docker container
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const config = require('../../../lib/config');
const buildCopy = require('../../../lib/utils/build-copy');
const {
  execCommand,
  testAppExists,
  testFileExists,
  testDockerRunning,
  testInfrastructureRunning,
  testContainerRunning,
  getLanguageAppName,
  getLanguagePort,
  sleep
} = require('../utils/integration-utils');

describe('Integration Step 07: Run Docker Container', () => {
  const language = process.env.TEST_LANGUAGE || 'python';
  const appName = getLanguageAppName(language);
  const port = getLanguagePort(language);

  // Increase timeout for this test suite (health check can take time)
  jest.setTimeout(180000); // 3 minutes

  it('should run Docker container and generate docker-compose.yaml', async() => {
    // Verify app exists (prerequisite check)
    const appInfo = await testAppExists(appName);
    if (!appInfo.builder) {
      throw new Error(`Prerequisite failed: Application not found. Run step-01-create.test.js first. App: ${appName}`);
    }

    // Check Docker is running
    const dockerRunning = await testDockerRunning();
    if (!dockerRunning) {
      throw new Error('Docker is not running. Please start Docker Desktop and try again.');
    }

    // Ensure infrastructure is running
    const infraRunning = await testInfrastructureRunning();
    if (!infraRunning) {
      console.warn('Infrastructure is not running. Starting infrastructure...');
      const infraResult = await execCommand('aifabrix up', 60000);
      if (infraResult.exitCode !== 0) {
        throw new Error('Could not start infrastructure. Run \'aifabrix up\' manually.');
      }
      console.log('Waiting for infrastructure to be healthy...');
      await sleep(10000);
    } else {
      console.log('Infrastructure is running');
    }

    // Run container
    console.log('Running Docker container...');
    const result = await execCommand(`aifabrix run ${appName} --port ${port}`, 150000); // 2.5 minute timeout for run
    const runExitCode = result.exitCode;

    // Always log output for debugging (not just on error)
    console.log('Run command exit code:', runExitCode);
    if (result.stdout) {
      console.log('Run command stdout:', result.stdout);
    }
    if (result.stderr) {
      console.log('Run command stderr:', result.stderr);
    }

    // Verify docker-compose.yaml was generated in dev-specific directory
    const developerId = await config.getDeveloperId();
    const devIdNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    const devDir = buildCopy.getDevDirectory(appName, developerId);
    const composeFile = path.join(devDir, 'docker-compose.yaml');
    const composeExists = await testFileExists(composeFile);

    // Calculate container name based on developer ID
    // Dev 0: aifabrix-{appName}, Dev > 0: aifabrix-dev{id}-{appName}
    const containerName = devIdNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;

    if (!composeExists) {
      // Provide more context if command failed
      if (runExitCode !== 0) {
        throw new Error(`docker-compose.yaml file not generated in ${devDir}. Run command failed with exit code ${runExitCode}. Error: ${result.stderr || result.stdout || 'Unknown error'}`);
      }
      throw new Error(`docker-compose.yaml file not generated in ${devDir}`);
    }
    expect(composeExists).toBe(true);

    // Verify compose file contains db-init service
    const composeContent = await fs.readFile(composeFile, 'utf8');
    if (!composeContent.includes('db-init:')) {
      throw new Error('docker-compose.yaml does not contain db-init service');
    }
    expect(composeContent).toContain('db-init:');

    if (!composeContent.includes('depends_on:')) {
      throw new Error('docker-compose.yaml does not contain depends_on');
    }
    expect(composeContent).toContain('depends_on:');

    // Wait for container to start
    await sleep(3000);

    // Verify container is running
    const containerRunning = await testContainerRunning(containerName);
    if (!containerRunning) {
      if (runExitCode !== 0) {
        throw new Error(`aifabrix run command failed with exit code: ${runExitCode}`);
      }
      throw new Error('Container is not running');
    }
    expect(containerRunning).toBe(true);

    // Wait for database initialization
    console.log('Waiting for database initialization...');
    await sleep(5000);
  });
});

