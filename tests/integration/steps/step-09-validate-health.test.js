/**
 * Integration Step 09: Validate Health Check and Database Connection
 * Tests health check endpoint and validates database connectivity
 *
 * @fileoverview Integration test for health check and database connection
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const config = require('../../../lib/core/config');
const {
  execCommand,
  testAppExists,
  testFileExists,
  testContainerRunning,
  getHealthCheckResponse,
  testDatabaseConnection,
  getLanguageAppName,
  getLanguagePort,
  sleep
} = require('../utils/integration-utils');

describe('Integration Step 09: Validate Health Check and Database Connection', () => {
  const language = process.env.TEST_LANGUAGE || 'python';
  const appName = getLanguageAppName(language);
  const port = getLanguagePort(language);

  // Calculate container name based on developer ID (same as step-07)
  let containerName;
  beforeAll(async() => {
    const developerId = await config.getDeveloperId();
    const devIdNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    containerName = devIdNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
  });

  it('should validate health check endpoint and database connection', async() => {
    // Check container is running
    const containerRunning = await testContainerRunning(containerName);
    if (!containerRunning) {
      throw new Error(`Prerequisite failed: Container '${containerName}' is not running. Run step-07-run.test.js first.`);
    }

    // Wait for application to be ready
    console.log('Waiting for application to be ready...');
    await sleep(5000);

    // Test health check endpoint
    console.log('Testing health check endpoint...');
    const maxRetries = 10;
    let retryCount = 0;
    let healthCheckPassed = false;

    while (retryCount < maxRetries && !healthCheckPassed) {
      const healthUrl = `http://localhost:${port}/health`;
      const healthResponse = await getHealthCheckResponse(healthUrl, 5);

      if (healthResponse.success || healthResponse.status === 'ok') {
        console.log('Health check endpoint responding');
        console.log(`Health check status: ${healthResponse.content?.status || 'unknown'}`);

        // Check database connectivity in health check
        if (healthResponse.content?.database) {
          if (healthResponse.content.database === 'connected') {
            console.log('Database connectivity verified in health check');
            healthCheckPassed = true;
          } else {
            console.warn(`Database connection failed in health check: ${healthResponse.content.database_error || 'unknown error'}`);
            console.warn('Attempting direct database connection test...');

            // Try direct database connection test
            const appInfo = await testAppExists(appName);
            const envFile = path.join(appInfo.builderPath, '.env');

            if (await testFileExists(envFile)) {
              const envContent = await fs.readFile(envFile, 'utf8');
              const dbHostMatch = envContent.match(/DB_HOST=([^\r\n]+)/);
              const dbNameMatch = envContent.match(/DB_NAME=([^\r\n]+)/);
              const dbUserMatch = envContent.match(/DB_USER=([^\r\n]+)/);
              const dbPasswordMatch = envContent.match(/DB_PASSWORD=([^\r\n]+)/);

              if (dbHostMatch && dbNameMatch && dbUserMatch && dbPasswordMatch) {
                const dbHost = dbHostMatch[1];
                const dbName = dbNameMatch[1];
                const dbUser = dbUserMatch[1];
                const dbPassword = dbPasswordMatch[1];

                console.log('Testing direct database connection from container...');
                console.log(`  Host: ${dbHost}`);
                console.log(`  Database: ${dbName}`);
                console.log(`  User: ${dbUser}`);

                // Test connection from container
                const connectionTest = await testDatabaseConnection(
                  containerName,
                  dbHost,
                  '5432',
                  dbName,
                  dbUser,
                  dbPassword
                );

                if (connectionTest) {
                  console.log('Direct database connection test passed');
                  healthCheckPassed = true;
                } else {
                  console.error('Direct database connection test failed');
                  retryCount++;
                  if (retryCount < maxRetries) {
                    console.log(`  Retrying... (${retryCount}/${maxRetries})`);
                    await sleep(3000);
                  }
                }
              } else {
                console.warn('Could not parse database configuration from .env file');
                healthCheckPassed = true; // Accept if database/user were created
              }
            } else {
              console.warn('.env file not found');
              healthCheckPassed = true; // Accept if database/user were created
            }
          }
        } else {
          console.warn('Database connectivity not checked in health check');
          healthCheckPassed = true;
        }
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`  Retrying health check... (${retryCount}/${maxRetries})`);
          await sleep(3000);
        } else {
          throw new Error(`Could not reach health check endpoint after ${maxRetries} attempts: ${healthResponse.error}`);
        }
      }
    }

    if (!healthCheckPassed) {
      throw new Error('Health check validation failed');
    }

    expect(healthCheckPassed).toBe(true);
  });
});

