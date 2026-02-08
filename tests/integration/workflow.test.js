/**
 * Integration Workflow Test Suite
 * Main test suite that runs all steps sequentially
 *
 * @fileoverview Orchestrates all integration test steps
 * @author AI Fabrix Team
 * @version 2.0.0
 *
 * Language Selection:
 * - Set TEST_LANGUAGE environment variable to 'python' or 'typescript'
 * - Defaults to 'python' if not set
 * - Use npm run test:integration:python or npm run test:integration:typescript
 */

const {
  getLanguageAppName,
  getLanguagePort,
  cleanupApp,
  testDockerRunning
} = require('./utils/integration-utils');

// Note: Step tests are automatically discovered by Jest's testMatch pattern
// They will run sequentially when using --runInBand flag
// Each step test reads TEST_LANGUAGE environment variable to determine which language to test

describe('Integration Workflow', () => {
  const language = process.env.TEST_LANGUAGE || 'python';
  const appName = getLanguageAppName(language);
  const port = getLanguagePort(language);

  beforeAll(async() => {
    // Check Docker availability
    const dockerRunning = await testDockerRunning();
    if (!dockerRunning) {
      console.error('\n❌ Docker is not running or not accessible.');
      console.error('Please start Docker Desktop before running integration tests.');
      console.error('Integration tests require Docker to build images and run containers.\n');
      throw new Error('Docker is not running. Start Docker Desktop and try again.');
    }

    // Cleanup existing app before starting
    await cleanupApp(appName);
  });

  afterAll(async() => {
    // Optional: Cleanup after all tests
    // Uncomment to cleanup after tests complete
    // await cleanupApp(appName);
  });

  // Note: Individual step tests will run in order due to Jest's execution with --runInBand
  // Each step test verifies prerequisites from previous steps
  // Tests run real CLI commands (aifabrix create, build, run, etc.) and end with a running Docker container
  it(`should complete all workflow steps sequentially for ${language}`, async() => {
    // This test serves as a summary/placeholder
    // Actual step execution happens in individual step test files:
    // - step-01-create.test.js: Creates application
    // - step-02-dockerfile.test.js: Generates Dockerfile
    // - step-03-resolve.test.js: Resolves secrets
    // - step-04-json.test.js: Generates deployment JSON
    // - step-06-build.test.js: Builds Docker image
    // - step-07-run.test.js: Runs Docker container (REAL running container)
    // - step-08-validate-database.test.js: Validates database creation
    // - step-09-validate-health.test.js: Validates health check endpoint
    expect(true).toBe(true);
  });
});

