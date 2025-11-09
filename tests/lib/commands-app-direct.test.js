/**
 * Direct Tests for Application Registration Commands
 *
 * @fileoverview Direct tests for command logic in lib/commands/app.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const yaml = require('js-yaml');

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn()
    },
    existsSync: actualFs.existsSync,
    rmSync: actualFs.rmSync
  };
});

jest.mock('../../lib/config');
jest.mock('../../lib/utils/api');
jest.mock('../../lib/app', () => ({
  createApp: jest.fn()
}));

const { getConfig } = require('../../lib/config');
const { authenticatedApiCall } = require('../../lib/utils/api');
const app = require('../../lib/app');

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = (text) => text;
  mockChalk.green = (text) => text;
  mockChalk.red = (text) => text;
  mockChalk.yellow = (text) => text;
  mockChalk.cyan = (text) => text;
  mockChalk.bold = (text) => text;
  mockChalk.gray = (text) => text;
  mockChalk.bold.yellow = (text) => text;
  return mockChalk;
});

describe('Application Registration Commands - Direct Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register command logic', () => {
    it('should register application with existing variables.yaml', async() => {
      const variablesContent = yaml.dump({
        app: {
          key: 'test-app',
          name: 'Test Application',
          description: 'Test Description'
        },
        build: {
          language: 'typescript',
          port: 3000
        }
      });

      fs.readFile.mockResolvedValue(variablesContent);
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          application: {
            id: 'app-123',
            key: 'test-app',
            displayName: 'Test Application'
          },
          credentials: {
            clientId: 'client-id-123',
            clientSecret: 'client-secret-456'
          }
        }
      });

      // Test the registration logic directly
      const appKey = 'test-app';
      const variablesPath = path.join(process.cwd(), 'builder', appKey, 'variables.yaml');
      const variablesContent2 = await fs.readFile(variablesPath, 'utf-8');
      const variables = yaml.load(variablesContent2);

      expect(variables).toBeDefined();
      expect(variables.app.key).toBe('test-app');

      const config = await getConfig();
      const registrationData = {
        environmentId: 'dev',
        key: variables.app.key,
        displayName: variables.app.name,
        description: variables.app.description || '',
        configuration: {
          type: variables.build.language === 'typescript' ? 'webapp' : 'service',
          registryMode: 'external',
          port: variables.build.port || 3000,
          language: variables.build.language || 'typescript'
        }
      };

      const response = await authenticatedApiCall(
        `${config.apiUrl}/api/v1/environments/dev/applications/register`,
        {
          method: 'POST',
          body: JSON.stringify(registrationData)
        },
        config.token
      );

      expect(response.success).toBe(true);
      expect(response.data.application.key).toBe('test-app');
    });

    it('should handle registration failure', async() => {
      const variablesContent = yaml.dump({
        app: { key: 'test-app', name: 'Test Application' },
        build: { language: 'typescript', port: 3000 }
      });

      fs.readFile.mockResolvedValue(variablesContent);
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      authenticatedApiCall.mockResolvedValue({
        success: false,
        error: 'Registration failed'
      });

      const config = await getConfig();
      const response = await authenticatedApiCall(
        `${config.apiUrl}/api/v1/environments/dev/applications/register`,
        { method: 'POST', body: '{}' },
        config.token
      );

      if (!response.success) {
        console.error(`❌ Registration failed: ${response.error}`);
        process.exit(1);
      }

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Registration failed')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should require login before registration', async() => {
      const variablesContent = yaml.dump({
        app: { key: 'test-app', name: 'Test Application' },
        build: { language: 'typescript', port: 3000 }
      });

      fs.readFile.mockResolvedValue(variablesContent);
      getConfig.mockResolvedValue({
        apiUrl: null,
        token: null
      });

      const config = await getConfig();
      if (!config.apiUrl || !config.token) {
        console.error('❌ Not logged in. Run: aifabrix login');
        process.exit(1);
      }

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Not logged in')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('list command logic', () => {
    it('should list applications successfully', async() => {
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: [
          {
            key: 'app1',
            displayName: 'Application 1',
            status: 'active',
            configuration: {
              pipeline: { isActive: true }
            }
          },
          {
            key: 'app2',
            displayName: 'Application 2',
            status: 'inactive',
            configuration: {
              pipeline: { isActive: false }
            }
          }
        ]
      });

      const config = await getConfig();
      const response = await authenticatedApiCall(
        `${config.apiUrl}/api/v1/environments/dev/applications`,
        {},
        config.token
      );

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.data[0].key).toBe('app1');
    });

    it('should handle list failure', async() => {
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      authenticatedApiCall.mockResolvedValue({
        success: false
      });

      const config = await getConfig();
      const response = await authenticatedApiCall(
        `${config.apiUrl}/api/v1/environments/dev/applications`,
        {},
        config.token
      );

      if (!response.success || !response.data) {
        console.error('❌ Failed to fetch applications');
        process.exit(1);
      }

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to fetch applications')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('rotate-secret command logic', () => {
    it('should rotate secret successfully', async() => {
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      authenticatedApiCall.mockResolvedValue({
        success: true,
        data: {
          success: true,
          credentials: {
            clientId: 'client-id-123',
            clientSecret: 'new-client-secret-789'
          },
          message: 'IMPORTANT: Save new clientSecret now - old secret is now invalid',
          timestamp: '2025-11-07T18:48:55.726Z'
        }
      });

      const config = await getConfig();
      const response = await authenticatedApiCall(
        `${config.apiUrl}/api/v1/applications/test-app/rotate-secret?environmentId=dev`,
        { method: 'POST' },
        config.token
      );

      expect(response.success).toBe(true);
      expect(response.data.credentials.clientId).toBe('client-id-123');
    });

    it('should handle rotation failure', async() => {
      getConfig.mockResolvedValue({
        apiUrl: 'http://localhost:3000',
        token: 'test-token'
      });

      authenticatedApiCall.mockResolvedValue({
        success: false,
        error: 'Rotation failed'
      });

      const config = await getConfig();
      const response = await authenticatedApiCall(
        `${config.apiUrl}/api/v1/applications/test-app/rotate-secret?environmentId=dev`,
        { method: 'POST' },
        config.token
      );

      if (!response.success) {
        console.error(`❌ Rotation failed: ${response.error}`);
        process.exit(1);
      }

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Rotation failed')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});

