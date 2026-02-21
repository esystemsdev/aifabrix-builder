/**
 * Tests for upload command (aifabrix upload <system-key>)
 *
 * @fileoverview Unit tests for lib/commands/upload.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

jest.mock('../../../lib/validation/validate', () => ({
  validateExternalSystemComplete: jest.fn()
}));
jest.mock('../../../lib/validation/validate-display', () => ({
  displayValidationResults: jest.fn()
}));
jest.mock('../../../lib/generator/external-controller-manifest', () => ({
  generateControllerManifest: jest.fn()
}));
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn(),
  requireBearerForDataplanePipeline: jest.fn()
}));
jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('http://controller:3000')
}));
jest.mock('../../../lib/core/config', () => ({
  resolveEnvironment: jest.fn().mockResolvedValue('dev')
}));
jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn().mockResolvedValue('http://dataplane:4000')
}));
jest.mock('../../../lib/api/pipeline.api', () => ({
  uploadApplicationViaPipeline: jest.fn(),
  validateUploadViaPipeline: jest.fn(),
  publishUploadViaPipeline: jest.fn()
}));
jest.mock('../../../lib/utils/api-error-handler', () => ({
  formatApiError: jest.fn((r) => r?.formattedError || r?.error || 'Unknown error')
}));
jest.mock('../../../lib/utils/credential-secrets-env', () => ({
  pushCredentialSecrets: jest.fn().mockResolvedValue({ pushed: 0 })
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));
jest.mock('chalk', () => {
  const mock = (s) => s;
  mock.green = (s) => s;
  mock.red = (s) => s;
  mock.blue = (s) => s;
  mock.yellow = (s) => s;
  mock.gray = (s) => s;
  return mock;
});

const logger = require('../../../lib/utils/logger');
const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
const { getDeploymentAuth } = require('../../../lib/utils/token-manager');
const { pushCredentialSecrets } = require('../../../lib/utils/credential-secrets-env');
const {
  uploadApplicationViaPipeline,
  validateUploadViaPipeline,
  publishUploadViaPipeline
} = require('../../../lib/api/pipeline.api');

describe('upload command', () => {
  const systemKey = 'my-hubspot';
  const mockManifest = {
    key: 'my-hubspot',
    version: '1.0.0',
    system: { key: 'my-hubspot', type: 'openapi', displayName: 'HubSpot' },
    dataSources: [{ key: 'ds1', systemKey: 'my-hubspot' }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    validateExternalSystemComplete.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    generateControllerManifest.mockResolvedValue(mockManifest);
    getDeploymentAuth.mockResolvedValue({ type: 'bearer', token: 'token' });
    pushCredentialSecrets.mockResolvedValue({ pushed: 0 });
    uploadApplicationViaPipeline.mockResolvedValue({ success: true, data: { uploadId: 'up-123' } });
    validateUploadViaPipeline.mockResolvedValue({ success: true });
    publishUploadViaPipeline.mockResolvedValue({ success: true });
  });

  describe('uploadExternalSystem', () => {
    it('should validate, build payload, resolve dataplane, then upload → validate → publish', async() => {
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey);

      expect(validateExternalSystemComplete).toHaveBeenCalledWith(systemKey, { type: 'external' });
      expect(generateControllerManifest).toHaveBeenCalledWith(systemKey, { type: 'external' });
      expect(getDeploymentAuth).toHaveBeenCalled();
      expect(pushCredentialSecrets).toHaveBeenCalledWith(
        'http://dataplane:4000',
        { type: 'bearer', token: 'token' },
        expect.objectContaining({
          envFilePath: expect.any(String),
          appName: systemKey,
          payload: expect.any(Object)
        })
      );
      expect(uploadApplicationViaPipeline).toHaveBeenCalledWith(
        'http://dataplane:4000',
        { type: 'bearer', token: 'token' },
        {
          version: '1.0.0',
          application: mockManifest.system,
          dataSources: mockManifest.dataSources
        }
      );
      expect(validateUploadViaPipeline).toHaveBeenCalledWith(
        'http://dataplane:4000',
        'up-123',
        { type: 'bearer', token: 'token' }
      );
      expect(publishUploadViaPipeline).toHaveBeenCalledWith(
        'http://dataplane:4000',
        'up-123',
        { type: 'bearer', token: 'token' }
      );
    });

    it('should log success when credential secrets are pushed', async() => {
      pushCredentialSecrets.mockResolvedValue({ pushed: 2 });
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Pushed 2 credential'));
    });

    it('should log warning when credential push returns warning', async() => {
      pushCredentialSecrets.mockResolvedValue({ pushed: 0, warning: 'Permission denied' });
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning: Permission denied'));
    });

    it('should use --dataplane override when provided', async() => {
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey, { dataplane: 'https://custom-dp.example.com' });

      expect(uploadApplicationViaPipeline).toHaveBeenCalledWith(
        'https://custom-dp.example.com',
        expect.any(Object),
        expect.any(Object)
      );
      expect(validateUploadViaPipeline).toHaveBeenCalledWith(
        'https://custom-dp.example.com',
        'up-123',
        expect.any(Object)
      );
    });

    it('should skip API calls and log payload on --dry-run', async() => {
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey, { dryRun: true });

      expect(validateExternalSystemComplete).toHaveBeenCalledWith(systemKey, { type: 'external' });
      expect(generateControllerManifest).toHaveBeenCalledWith(systemKey, { type: 'external' });
      expect(uploadApplicationViaPipeline).not.toHaveBeenCalled();
      expect(validateUploadViaPipeline).not.toHaveBeenCalled();
      expect(publishUploadViaPipeline).not.toHaveBeenCalled();
    });

    it('should display validation errors and throw when validation fails', async() => {
      const { displayValidationResults } = require('../../../lib/validation/validate-display');
      validateExternalSystemComplete.mockResolvedValue({
        valid: false,
        errors: ['Missing application.yaml'],
        warnings: []
      });

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem(systemKey)).rejects.toThrow('Validation failed');
      expect(displayValidationResults).toHaveBeenCalled();
      expect(uploadApplicationViaPipeline).not.toHaveBeenCalled();
    });

    it('should throw when upload returns no uploadId', async() => {
      uploadApplicationViaPipeline.mockResolvedValue({ success: true, data: {} });

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem(systemKey)).rejects.toThrow(/upload ID|Upload did not return/);
    });

    it('should throw when validate upload fails', async() => {
      validateUploadViaPipeline.mockResolvedValue({
        success: false,
        error: 'Invalid config',
        formattedError: 'Invalid config'
      });

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem(systemKey)).rejects.toThrow(/Upload validation failed/);
      expect(publishUploadViaPipeline).not.toHaveBeenCalled();
    });

    it('should throw when upload API fails', async() => {
      uploadApplicationViaPipeline.mockRejectedValue(new Error('Network error'));

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem(systemKey)).rejects.toThrow('Network error');
    });

    it('should throw when system-key is empty', async() => {
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem('')).rejects.toThrow('System key is required');
      await expect(uploadExternalSystem(null)).rejects.toThrow('System key is required');
    });

    it('should throw when system-key has invalid format', async() => {
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem('Invalid Key!')).rejects.toThrow(
        'System key must contain only lowercase letters'
      );
    });
  });

  describe('buildUploadPayload', () => {
    it('should map manifest to { version, application, dataSources }', () => {
      const { buildUploadPayload } = require('../../../lib/commands/upload');
      const payload = buildUploadPayload(mockManifest);
      expect(payload).toEqual({
        version: '1.0.0',
        application: mockManifest.system,
        dataSources: mockManifest.dataSources
      });
    });

    it('should default version when missing', () => {
      const { buildUploadPayload } = require('../../../lib/commands/upload');
      const manifest = { ...mockManifest, version: undefined };
      const payload = buildUploadPayload(manifest);
      expect(payload.version).toBe('1.0.0');
    });
  });

  describe('validateSystemKeyFormat', () => {
    it('should accept valid system-key', () => {
      const { validateSystemKeyFormat } = require('../../../lib/commands/upload');
      expect(() => validateSystemKeyFormat('my-app')).not.toThrow();
      expect(() => validateSystemKeyFormat('my_app-123')).not.toThrow();
    });

    it('should reject invalid system-key', () => {
      const { validateSystemKeyFormat } = require('../../../lib/commands/upload');
      expect(() => validateSystemKeyFormat('Uppercase')).toThrow(/lowercase/);
      expect(() => validateSystemKeyFormat('has space')).toThrow(/lowercase/);
    });
  });
});
