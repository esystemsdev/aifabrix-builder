/**
 * Tests for upload command (aifabrix upload <systemKey>)
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
jest.mock('../../../lib/external-system/sync-deploy-manifest', () => ({
  syncDeployJsonFromSources: jest.fn().mockResolvedValue('/integration/my-hubspot/my-hubspot-deploy.json')
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
  validatePipelineConfig: jest.fn(),
  testSystemViaPipeline: jest.fn()
}));
jest.mock('../../../lib/utils/api-error-handler', () => ({
  formatApiError: jest.fn((r) => r?.formattedError || r?.error || 'Unknown error')
}));
jest.mock('../../../lib/utils/credential-secrets-env', () => ({
  pushCredentialSecrets: jest.fn().mockResolvedValue({ pushed: 0 })
}));
jest.mock('../../../lib/utils/configuration-env-resolver', () => {
  const actual = jest.requireActual('../../../lib/utils/configuration-env-resolver');
  return {
    ...actual,
    buildResolvedEnvMapForIntegration: jest.fn(),
    resolveConfigurationValues: jest.fn()
  };
});
jest.mock('../../../lib/utils/dataplane-pipeline-warning', () => ({
  logDataplanePipelineWarning: jest.fn()
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
  mock.bold = (s) => s;
  mock.cyan = (s) => s;
  const white = (s) => s;
  white.bold = (s) => s;
  mock.white = white;
  return mock;
});

const logger = require('../../../lib/utils/logger');
const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
const { generateControllerManifest } = require('../../../lib/generator/external-controller-manifest');
const { getDeploymentAuth } = require('../../../lib/utils/token-manager');
const { pushCredentialSecrets } = require('../../../lib/utils/credential-secrets-env');
const { uploadApplicationViaPipeline } = require('../../../lib/api/pipeline.api');
const {
  buildResolvedEnvMapForIntegration,
  resolveConfigurationValues
} = require('../../../lib/utils/configuration-env-resolver');
const { logDataplanePipelineWarning } = require('../../../lib/utils/dataplane-pipeline-warning');
const { syncDeployJsonFromSources } = require('../../../lib/external-system/sync-deploy-manifest');

describe('upload command', () => {
  const systemKey = 'my-hubspot';
  const mockManifest = {
    key: 'my-hubspot',
    version: '1.0.0',
    system: { key: 'my-hubspot', type: 'openapi', displayName: 'HubSpot' },
    dataSources: [{ key: 'ds1', systemKey: 'my-hubspot' }]
  };

  const mockPublication = {
    uploadId: 'up_test',
    uploadStatus: 'published',
    generateMcpContract: true,
    system: { key: 'my-hubspot', status: 'published' },
    datasources: [{ key: 'ds1', status: 'published', isActive: true, mcpContract: {} }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    validateExternalSystemComplete.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    generateControllerManifest.mockResolvedValue(mockManifest);
    getDeploymentAuth.mockResolvedValue({ type: 'bearer', token: 'token' });
    pushCredentialSecrets.mockResolvedValue({ pushed: 0 });
    uploadApplicationViaPipeline.mockResolvedValue({ success: true, data: mockPublication });
    const { validatePipelineConfig, testSystemViaPipeline } = require('../../../lib/api/pipeline.api');
    validatePipelineConfig.mockResolvedValue({ success: true, data: { isValid: true, warnings: [] } });
    testSystemViaPipeline.mockResolvedValue({
      success: true,
      data: { success: true, results: [{ sourceKey: 'ds1', success: true, validationResults: { isValid: true } }] }
    });
    buildResolvedEnvMapForIntegration.mockResolvedValue({ envMap: {}, secrets: {} });
    resolveConfigurationValues.mockImplementation(() => {});
  });

  describe('uploadExternalSystem', () => {
    it('should validate, build payload, resolve configuration, push secrets, then pipeline upload', async() => {
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey);

      expect(validateExternalSystemComplete).toHaveBeenCalledWith(systemKey, { type: 'external' });
      expect(syncDeployJsonFromSources).toHaveBeenCalledWith(systemKey);
      expect(generateControllerManifest).toHaveBeenCalledWith(systemKey, { type: 'external' });
      expect(buildResolvedEnvMapForIntegration).toHaveBeenCalledWith(systemKey);
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
          dataSources: mockManifest.dataSources,
          status: 'draft'
        }
      );
      expect(logDataplanePipelineWarning).toHaveBeenCalledTimes(1);
    });

    it('should call validation/run without payloadTemplate for --probe (full engine path)', async() => {
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      const { testSystemViaPipeline } = require('../../../lib/api/pipeline.api');
      await uploadExternalSystem(systemKey, { probe: true });
      expect(testSystemViaPipeline).toHaveBeenCalledWith(
        'http://dataplane:4000',
        systemKey,
        { type: 'bearer', token: 'token' },
        {},
        expect.objectContaining({ timeout: 120000 })
      );
    });

    it('should call configuration resolver for application and datasource configuration before upload', async() => {
      const manifestWithConfig = {
        key: 'my-hubspot',
        version: '1.0.0',
        system: {
          key: 'my-hubspot',
          type: 'openapi',
          displayName: 'HubSpot',
          configuration: [{ name: 'SITE_ID', value: '{{SITE_ID}}', location: 'variable' }]
        },
        dataSources: [{
          key: 'ds1',
          systemKey: 'my-hubspot',
          configuration: [{ name: 'API_KEY', value: '{{API_KEY}}', location: 'variable' }]
        }]
      };
      generateControllerManifest.mockResolvedValue(manifestWithConfig);
      buildResolvedEnvMapForIntegration.mockResolvedValue({
        envMap: { SITE_ID: '123', API_KEY: 'secret-key' },
        secrets: {}
      });
      resolveConfigurationValues.mockImplementation((arr) => {
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item?.location === 'variable' && item.value === '{{SITE_ID}}') item.value = '123';
            if (item?.location === 'variable' && item.value === '{{API_KEY}}') item.value = 'secret-key';
          }
        }
      });
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey);

      expect(buildResolvedEnvMapForIntegration).toHaveBeenCalledWith(systemKey);
      expect(resolveConfigurationValues).toHaveBeenCalledWith(
        expect.any(Array),
        { SITE_ID: '123', API_KEY: 'secret-key' },
        {},
        systemKey
      );
      expect(resolveConfigurationValues).toHaveBeenCalledTimes(2);
      const payload = uploadApplicationViaPipeline.mock.calls[0][2];
      expect(payload.application.configuration[0].value).toBe('123');
      expect(payload.dataSources[0].configuration[0].value).toBe('secret-key');
    });

    it('should log success with keys when credential secrets are pushed', async() => {
      pushCredentialSecrets.mockResolvedValue({ pushed: 2, keys: ['hubspot/clientid', 'hubspot/clientsecret'] });
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Pushed 2 credential'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('hubspot/clientid'));
    });

    it('should log resolved integration parameter names when configuration variables are resolved', async() => {
      const manifestWithConfig = {
        key: 'test-e2e-sharepoint',
        version: '1.0.0',
        system: {
          key: 'test-e2e-sharepoint',
          configuration: [
            { name: 'SHAREPOINT_SITE_ID', value: '{{SHAREPOINT_SITE_ID}}', location: 'variable' },
            { name: 'SHAREPOINT_LIST_ID', value: '{{SHAREPOINT_LIST_ID}}', location: 'variable' }
          ]
        },
        dataSources: []
      };
      generateControllerManifest.mockResolvedValue(manifestWithConfig);
      buildResolvedEnvMapForIntegration.mockResolvedValue({
        envMap: {
          SHAREPOINT_SITE_ID: 'contoso.sharepoint.com,site-guid,web-guid',
          SHAREPOINT_LIST_ID: 'bfe808fe-2a48-4b8e-806b-55d0b8ccf693'
        },
        secrets: {}
      });
      resolveConfigurationValues.mockImplementation((arr) => {
        if (!Array.isArray(arr)) return;
        for (const item of arr) {
          if (item?.location !== 'variable' || typeof item.value !== 'string') continue;
          if (item.value === '{{SHAREPOINT_SITE_ID}}') item.value = 'contoso.sharepoint.com,site-guid,web-guid';
          if (item.value === '{{SHAREPOINT_LIST_ID}}') item.value = 'bfe808fe-2a48-4b8e-806b-55d0b8ccf693';
        }
      });
      pushCredentialSecrets.mockResolvedValue({ pushed: 1, keys: ['test-e2e-sharepoint/clientId'] });
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey);
      const resolvedLog = (logger.log.mock.calls || []).map((c) => c[0]).find((s) => typeof s === 'string' && s.includes('Resolved 2 integration parameter'));
      expect(resolvedLog).toBeDefined();
      expect(resolvedLog).toContain('SHAREPOINT_SITE_ID');
      expect(resolvedLog).toContain('SHAREPOINT_LIST_ID');
    });

    it('should log Secret push skipped in yellow when no secrets to push', async() => {
      pushCredentialSecrets.mockResolvedValue({ pushed: 0, skipped: true });
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Secret push skipped'));
    });

    it('should log warning when credential push returns warning', async() => {
      pushCredentialSecrets.mockResolvedValue({ pushed: 0, warning: 'Permission denied' });
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning: Permission denied'));
    });

    it('should skip API calls and log payload on --dry-run', async() => {
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey, { dryRun: true });

      expect(validateExternalSystemComplete).toHaveBeenCalledWith(systemKey, { type: 'external' });
      expect(syncDeployJsonFromSources).not.toHaveBeenCalled();
      expect(generateControllerManifest).toHaveBeenCalledWith(systemKey, { type: 'external' });
      expect(uploadApplicationViaPipeline).not.toHaveBeenCalled();
      expect(logDataplanePipelineWarning).not.toHaveBeenCalled();
    });

    it('should throw when configuration resolution fails (missing env var)', async() => {
      const manifestWithConfig = {
        key: 'my-hubspot',
        version: '1.0.0',
        system: {
          key: 'my-hubspot',
          configuration: [{ name: 'MISSING_VAR', value: '{{MISSING_VAR}}', location: 'variable' }]
        },
        dataSources: []
      };
      generateControllerManifest.mockResolvedValue(manifestWithConfig);
      buildResolvedEnvMapForIntegration.mockResolvedValue({ envMap: {}, secrets: {} });
      resolveConfigurationValues.mockImplementation(() => {
        throw new Error('Missing configuration env var: MISSING_VAR. Run \'aifabrix resolve my-hubspot\' or set the variable in .env.');
      });

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem(systemKey)).rejects.toThrow('Missing configuration env var');
      expect(uploadApplicationViaPipeline).not.toHaveBeenCalled();
    });

    it('should throw when buildResolvedEnvMapForIntegration rejects', async() => {
      buildResolvedEnvMapForIntegration.mockRejectedValue(new Error('Secrets file not found'));

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem(systemKey)).rejects.toThrow('Secrets file not found');
      expect(uploadApplicationViaPipeline).not.toHaveBeenCalled();
    });

    it('should throw when auth-section keyvault config entry fails to resolve and error must not expose secret', async() => {
      const manifestWithAuthConfig = {
        key: 'my-hubspot',
        version: '1.0.0',
        system: {
          key: 'my-hubspot',
          configuration: [
            { name: 'KV_MY_HUBSPOT_CLIENTID', value: 'my-hubspot/clientid', location: 'keyvault' },
            { name: 'KV_MY_HUBSPOT_CLIENTSECRET', value: 'my-hubspot/clientsecret', location: 'keyvault' }
          ]
        },
        dataSources: []
      };
      generateControllerManifest.mockResolvedValue(manifestWithAuthConfig);
      buildResolvedEnvMapForIntegration.mockResolvedValue({
        envMap: {},
        secrets: { 'my-hubspot/clientid': 'actual-secret' }
      });
      resolveConfigurationValues.mockImplementation(() => {
        throw new Error('Unresolved keyvault reference for configuration \'KV_MY_HUBSPOT_CLIENTSECRET\'. Run \'aifabrix resolve my-hubspot\' and ensure the key exists in the secrets file.');
      });

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      let err;
      await uploadExternalSystem(systemKey).catch((e) => {
        err = e;
      });
      expect(err).toBeDefined();
      expect(err.message).toMatch(/Unresolved keyvault reference/);
      expect(err.message).toMatch(/KV_MY_HUBSPOT_CLIENTSECRET/);
      expect(err.message).not.toMatch(/actual-secret/);
      expect(uploadApplicationViaPipeline).not.toHaveBeenCalled();
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

    it('should include actual validation errors in thrown message when validation fails', async() => {
      const { displayValidationResults } = require('../../../lib/validation/validate-display');
      const err1 = 'External datasource file not found: /path/to/missing.json';
      validateExternalSystemComplete.mockResolvedValue({
        valid: false,
        errors: [err1],
        warnings: []
      });

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      const err = await uploadExternalSystem(systemKey).catch(e => e);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('Validation failed');
      expect(err.message).toContain(err1);
      expect(err.message).toMatch(/Fix errors above|run the command again/);
    });

    it('should include up to 3 errors and "and N more" when many validation errors', async() => {
      validateExternalSystemComplete.mockResolvedValue({
        valid: false,
        errors: ['Error1', 'Error2', 'Error3', 'Error4', 'Error5'],
        warnings: []
      });

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      const err = await uploadExternalSystem(systemKey).catch(e => e);
      expect(err.message).toContain('Error1');
      expect(err.message).toContain('Error2');
      expect(err.message).toContain('Error3');
      expect(err.message).toContain('and 2 more');
    });

    it('should throw when upload returns success: false', async() => {
      uploadApplicationViaPipeline.mockResolvedValue({
        success: false,
        error: 'Validation failed',
        formattedError: 'Validation failed'
      });

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem(systemKey)).rejects.toThrow(/Validation failed/);
    });

    it('should throw when upload API fails', async() => {
      uploadApplicationViaPipeline.mockRejectedValue(new Error('Network error'));

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem(systemKey)).rejects.toThrow('Network error');
    });

    it('should throw when upload response is not a publication result', async() => {
      uploadApplicationViaPipeline.mockResolvedValue({ success: true, data: { systemKey: 'my-hubspot' } });

      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await expect(uploadExternalSystem(systemKey)).rejects.toThrow(/Unexpected response from dataplane upload/);
    });

    it('should call validatePipelineConfig when --verbose', async() => {
      const { validatePipelineConfig } = require('../../../lib/api/pipeline.api');
      const { uploadExternalSystem } = require('../../../lib/commands/upload');
      await uploadExternalSystem(systemKey, { verbose: true });
      expect(validatePipelineConfig).toHaveBeenCalledWith(
        'http://dataplane:4000',
        { type: 'bearer', token: 'token' },
        expect.objectContaining({
          config: expect.objectContaining({
            version: '1.0.0',
            application: mockManifest.system,
            dataSources: mockManifest.dataSources
          })
        })
      );
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
    it('should map manifest to { version, application, dataSources, status: "draft" }', () => {
      const { buildUploadPayload } = require('../../../lib/commands/upload');
      const payload = buildUploadPayload(mockManifest);
      expect(payload).toEqual({
        version: '1.0.0',
        application: mockManifest.system,
        dataSources: mockManifest.dataSources,
        status: 'draft'
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

  describe('runUploadValidatePublish', () => {
    it('should return publication result when upload succeeds', async() => {
      const pubResult = { success: true, data: { systemKey: 'my-hubspot', datasourceKeys: ['ds1'] } };
      uploadApplicationViaPipeline.mockResolvedValue(pubResult);

      const { runUploadValidatePublish } = require('../../../lib/commands/upload');
      const result = await runUploadValidatePublish(
        'http://dataplane:4000',
        { type: 'bearer', token: 't' },
        { version: '1.0.0', application: {}, dataSources: [], status: 'draft' }
      );

      expect(result).toEqual(pubResult);
      expect(uploadApplicationViaPipeline).toHaveBeenCalledTimes(1);
    });

    it('should throw with formatted message when upload returns success: false', async() => {
      uploadApplicationViaPipeline.mockResolvedValue({
        success: false,
        error: 'Config invalid',
        formattedError: 'Config invalid: missing required field'
      });

      const { runUploadValidatePublish } = require('../../../lib/commands/upload');
      await expect(
        runUploadValidatePublish('http://dp:4000', {}, { version: '1.0.0', application: {}, dataSources: [], status: 'draft' })
      ).rejects.toThrow(/Config invalid: missing required field/);
    });
  });
});
