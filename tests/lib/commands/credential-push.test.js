/**
 * Tests for credential push command
 *
 * @fileoverview Unit tests for commands/credential-push.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('chalk', () => {
  const m = (t) => t;
  m.blue = (t) => t;
  m.green = (t) => t;
  m.yellow = (t) => t;
  return m;
});
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn(), error: jest.fn() }));
jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((key) => `/workspace/integration/${key}`)
}));
jest.mock('../../../lib/utils/credential-secrets-env', () => ({
  pushCredentialSecrets: jest.fn()
}));
jest.mock('../../../lib/utils/controller-url', () => ({ resolveControllerUrl: jest.fn() }));
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn(),
  requireBearerForDataplanePipeline: jest.fn()
}));
jest.mock('../../../lib/utils/dataplane-resolver', () => ({ resolveDataplaneUrl: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({ resolveEnvironment: jest.fn() }));
jest.mock('../../../lib/generator/external-controller-manifest', () => ({
  generateControllerManifest: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { pushCredentialSecrets } = require('../../../lib/utils/credential-secrets-env');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getDeploymentAuth, requireBearerForDataplanePipeline } = require('../../../lib/utils/token-manager');
const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
const { resolveEnvironment } = require('../../../lib/core/config');
const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
const { runCredentialPush, validateSystemKeyFormat } = require('../../../lib/commands/credential-push');

describe('Credential push command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    resolveEnvironment.mockResolvedValue('dev');
    getDeploymentAuth.mockResolvedValue({ token: 'test-token', type: 'bearer' });
    resolveDataplaneUrl.mockResolvedValue('https://dataplane.example.com');
    generateControllerManifest.mockResolvedValue({
      version: '1.0.0',
      system: { key: 'hubspot' },
      dataSources: []
    });
  });

  describe('validateSystemKeyFormat', () => {
    it('should accept valid system keys', () => {
      expect(() => validateSystemKeyFormat('hubspot')).not.toThrow();
    });
    it('should reject invalid', () => {
      expect(() => validateSystemKeyFormat('')).toThrow('required');
      expect(() => validateSystemKeyFormat('Invalid')).toThrow('lowercase');
    });
  });

  describe('runCredentialPush', () => {
    it('should push credentials and log success', async() => {
      pushCredentialSecrets.mockResolvedValue({ pushed: 2, keys: ['hubspot/clientid', 'hubspot/clientsecret'] });

      const result = await runCredentialPush('hubspot');

      expect(getDeploymentAuth).toHaveBeenCalled();
      expect(resolveDataplaneUrl).toHaveBeenCalled();
      expect(pushCredentialSecrets).toHaveBeenCalledWith(
        'https://dataplane.example.com',
        expect.objectContaining({ token: 'test-token' }),
        expect.objectContaining({
          envFilePath: expect.stringContaining('.env'),
          appName: 'hubspot',
          payload: expect.any(Object)
        })
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Pushed 2'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('hubspot/clientid'));
      expect(result.pushed).toBe(2);
    });

    it('should log skipped when nothing to push', async() => {
      pushCredentialSecrets.mockResolvedValue({ pushed: 0, skipped: true });

      const result = await runCredentialPush('hubspot');

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No credential secrets'));
      expect(result.pushed).toBe(0);
    });

    it('should log warning when push returns warning', async() => {
      pushCredentialSecrets.mockResolvedValue({ pushed: 0, warning: 'Permission denied' });

      await runCredentialPush('hubspot');

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning: Permission denied'));
    });

    it('should throw when auth is missing', async() => {
      getDeploymentAuth.mockResolvedValue({});

      await expect(runCredentialPush('hubspot')).rejects.toThrow('Authentication required');
      expect(pushCredentialSecrets).not.toHaveBeenCalled();
    });

    it('should throw when system key invalid', async() => {
      await expect(runCredentialPush('')).rejects.toThrow('required');
      await expect(runCredentialPush('Invalid')).rejects.toThrow('lowercase');
      expect(pushCredentialSecrets).not.toHaveBeenCalled();
    });
  });
});
