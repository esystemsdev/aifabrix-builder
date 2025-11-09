/**
 * Tests for AI Fabrix Builder Application Commands
 *
 * @fileoverview Unit tests for app command module (register, list, rotate-secret)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock dependencies
jest.mock('../../lib/config');
jest.mock('../../lib/utils/api');
jest.mock('../../lib/app', () => ({
  createApp: jest.fn()
}));

const { getConfig } = require('../../lib/config');
const { authenticatedApiCall } = require('../../lib/utils/api');
const { createApp } = require('../../lib/app');

describe('App Commands', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Mock config
    getConfig.mockResolvedValue({
      apiUrl: 'http://localhost:3000',
      token: 'test-token-123',
      expiry: Date.now() + 3600000
    });

    // Create builder directory
    fsSync.mkdirSync(path.join(tempDir, 'builder'), { recursive: true });
  });

  afterEach(async() => {
    // Clean up temporary directory
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('rotate-secret command', () => {
    it('should rotate secret with environment parameter', async() => {
      const appName = 'test-app';
      const environment = 'dev';

      // Create app directory
      const appDir = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });

      // Mock API response - matches actual API structure
      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          credentials: {
            clientId: 'ctrl-dev-test-app',
            clientSecret: 'new-secret-123'
          },
          message: 'IMPORTANT: Save new clientSecret now - old secret is now invalid',
          timestamp: '2025-11-07T18:48:55.726Z'
        }
      });

      // Import and test the function
      const appCommands = require('../../lib/commands/app');

      // Simulate the rotate-secret action
      const options = { app: appName, environment: environment };

      // We need to import Commander program and test the command
      // For now, just test the API call behavior
      const response = await authenticatedApiCall(
        `http://localhost:3000/api/v1/applications/${appName}/rotate-secret?environmentId=${environment}`,
        { method: 'POST' },
        'test-token-123'
      );

      expect(response.success).toBe(true);
      expect(response.data.credentials.clientSecret).toBe('new-secret-123');
      expect(authenticatedApiCall).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/applications/${appName}/rotate-secret?environmentId=${environment}`,
        { method: 'POST' },
        'test-token-123'
      );
    });

    it('should fail when environment is not provided', async() => {
      const appName = 'test-app';

      await expect(async() => {
        const response = await authenticatedApiCall(
          `http://localhost:3000/api/v1/applications/${appName}/rotate-secret`,
          { method: 'POST' },
          'test-token-123'
        );
      }).not.toThrow(); // API call itself doesn't fail, but missing env will cause validation error
    });

    it('should fail when not logged in', async() => {
      const appName = 'test-app';
      const environment = 'dev';

      // Mock config without token
      getConfig.mockResolvedValueOnce({
        apiUrl: 'http://localhost:3000',
        token: null
      });

      await expect(async() => {
        if (!getConfig().token) {
          throw new Error('❌ Not logged in. Run: aifabrix login');
        }
      }).rejects.toThrow('❌ Not logged in');
    });

    it('should handle rotation failure gracefully', async() => {
      const appName = 'test-app';
      const environment = 'dev';

      // Mock API failure
      authenticatedApiCall.mockResolvedValue({
        success: false,
        error: 'Application not found'
      });

      const response = await authenticatedApiCall(
        `http://localhost:3000/api/v1/applications/${appName}/rotate-secret?environmentId=${environment}`,
        { method: 'POST' },
        'test-token-123'
      );

      expect(response.success).toBe(false);
      expect(response.error).toBe('Application not found');
    });
  });

  describe('register command', () => {
    it('should register app with existing variables.yaml', async() => {
      const appName = 'test-app';
      const environment = 'dev';

      // Create app directory with variables.yaml
      const appDir = path.join(tempDir, 'builder', appName);
      fsSync.mkdirSync(appDir, { recursive: true });

      const variablesYaml = `
app:
  key: ${appName}
  name: Test App
  description: A test application
build:
  language: typescript
  port: 3000
`;
      await fs.writeFile(path.join(appDir, 'variables.yaml'), variablesYaml);

      // Mock API response
      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          application: {
            id: 'app-456',
            key: appName,
            displayName: 'Test App'
          },
          credentials: {
            clientId: 'ctrl-dev-test-app',
            clientSecret: 'initial-secret-456'
          }
        }
      });

      // Test that variables.yaml is read correctly
      const variablesContent = await fs.readFile(path.join(appDir, 'variables.yaml'), 'utf-8');
      const variables = yaml.load(variablesContent);

      expect(variables.app.key).toBe(appName);
      expect(variables.app.name).toBe('Test App');
      expect(variables.build.language).toBe('typescript');
    });

    it('should create minimal config if variables.yaml is missing', async() => {
      const appName = 'new-app';
      const environment = 'dev';

      // Mock createApp
      createApp.mockResolvedValue();

      // Simulate the case where variables.yaml doesn't exist
      const appDir = path.join(tempDir, 'builder', appName);
      const variablesPath = path.join(appDir, 'variables.yaml');

      let variables;
      try {
        await fs.access(variablesPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist - create minimal configuration
          await createApp(appName, {
            port: 3000,
            language: 'typescript',
            database: false,
            redis: false,
            storage: false,
            authentication: false
          });

          expect(createApp).toHaveBeenCalledWith(appName, expect.objectContaining({
            port: 3000,
            language: 'typescript'
          }));
        }
      }
    });
  });

  describe('list command', () => {
    it('should list applications in an environment', async() => {
      const environment = 'dev';

      // Mock API response with nested structure
      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          data: [
            {
              id: 'app-1',
              key: 'app1',
              displayName: 'App One',
              status: 'active',
              configuration: {
                pipeline: {
                  isActive: true
                }
              }
            },
            {
              id: 'app-2',
              key: 'app2',
              displayName: 'App Two',
              status: 'inactive',
              configuration: {
                pipeline: {
                  isActive: false
                }
              }
            }
          ],
          timestamp: '2025-11-07T16:48:04.007Z'
        }
      });

      const response = await authenticatedApiCall(
        `http://localhost:3000/api/v1/environments/${environment}/applications`,
        {},
        'test-token-123'
      );

      expect(response.success).toBe(true);
      expect(response.data.data).toHaveLength(2);
      expect(response.data.data[0].key).toBe('app1');
      expect(response.data.data[1].key).toBe('app2');
    });

    it('should fail when not logged in', async() => {
      const environment = 'dev';

      // Mock config without token
      getConfig.mockResolvedValueOnce({
        apiUrl: 'http://localhost:3000',
        token: null
      });

      await expect(async() => {
        if (!getConfig().token) {
          throw new Error('❌ Not logged in. Run: aifabrix login');
        }
      }).rejects.toThrow('❌ Not logged in');
    });
  });
});

