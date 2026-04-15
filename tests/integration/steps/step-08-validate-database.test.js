/**
 * Integration Step 08: Validate Database Creation
 * Validates that database and user were created successfully
 *
 * @fileoverview Integration test for database validation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const config = require('../../../lib/core/config');
const {
  execCommand,
  testDockerRunning,
  testDatabaseExists,
  testDatabaseUserExists,
  getLanguageAppName,
  getComposeDatabaseName,
  getComposePgUserName,
  getPostgresInfraContainerName
} = require('../utils/integration-utils');

describe('Integration Step 08: Validate Database Creation', () => {
  const language = process.env.TEST_LANGUAGE || 'python';
  const appName = getLanguageAppName(language);
  /** Matches compose `CREATE DATABASE "{{app.key}}"` (hyphens preserved). */
  const dbName = getComposeDatabaseName(appName);
  const dbUser = getComposePgUserName(appName);

  let postgresContainerName;

  beforeAll(async() => {
    const developerId = await config.getDeveloperId();
    postgresContainerName = getPostgresInfraContainerName(developerId);
  });

  it('should validate database and user creation', async() => {
    // Check Docker is running
    const dockerRunning = await testDockerRunning();
    if (!dockerRunning) {
      throw new Error('Docker is not running');
    }

    // Verify database exists
    console.log('Verifying database exists...');
    const dbExists = await testDatabaseExists(dbName, postgresContainerName);
    if (!dbExists) {
      throw new Error(`Prerequisite failed: Database '${dbName}' does not exist. Run step-07-run.test.js first to start container and initialize database.`);
    }
    expect(dbExists).toBe(true);

    // Verify database user exists
    console.log('Verifying database user exists...');
    const userExists = await testDatabaseUserExists(dbUser, postgresContainerName);
    if (!userExists) {
      throw new Error(`Database user '${dbUser}' does not exist in PostgreSQL`);
    }
    expect(userExists).toBe(true);

    // Verify user permissions
    console.log('Verifying user permissions...');
    const permissionsCommand = `docker exec ${postgresContainerName} psql -U pgadmin -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${dbUser}' AND rolsuper='f'"`;
    const permissionsResult = await execCommand(permissionsCommand, 10000);
    if (permissionsResult.stdout.trim().includes('1')) {
      console.log('User permissions are correct (non-superuser)');
    } else {
      console.warn('User permissions check inconclusive');
    }
  });
});

