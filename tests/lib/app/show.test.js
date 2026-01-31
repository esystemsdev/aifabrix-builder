/**
 * Tests for lib/app/show.js
 *
 * @fileoverview Unit tests for aifabrix show command (offline and online)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    readFileSync: jest.fn()
  };
});
jest.mock('../../../lib/utils/paths');
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('http://localhost:3000')
}));
jest.mock('../../../lib/api/applications.api');
jest.mock('../../../lib/api/external-systems.api');
jest.mock('../../../lib/utils/dataplane-resolver');
jest.mock('../../../lib/generator');
jest.mock('../../../lib/utils/api-error-handler');
jest.mock('../../../lib/utils/error-formatters/http-status-errors');
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.gray = (text) => text;
  mockChalk.blue = (text) => text;
  mockChalk.red = (text) => text;
  mockChalk.bold = (text) => text;
  return mockChalk;
});

const path = require('path');
const fs = require('fs');
const { detectAppType } = require('../../../lib/utils/paths');
const config = require('../../../lib/core/config');
const { getApplication } = require('../../../lib/api/applications.api');
const logger = require('../../../lib/utils/logger');
const generator = require('../../../lib/generator');
const {
  showApp,
  loadVariablesFromPath,
  getPortalInputConfigurations,
  buildOfflineSummary,
  buildOfflineSummaryFromDeployJson,
  buildOnlineSummary,
  formatHealthCheckForDisplay,
  formatBuildForDisplay,
  getShowAuthToken
} = require('../../../lib/app/show');

const minimalVariablesYaml = `
app:
  key: myapp
  displayName: My Application
  description: My app description
  type: webapp
  deploymentKey: a1b2c3d4e5f6789012345678901234567890123456789012345678901234
  image: myreg/myapp:latest
  registryMode: acr
  port: 3000
`;

describe('lib/app/show.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.log.mockImplementation(() => {});
  });

  describe('offline (default)', () => {
    it('should load and display app info from variables.yaml (no validation)', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      detectAppType.mockResolvedValue({ appPath });
      const variablesPath = path.join(appPath, 'variables.yaml');
      fs.existsSync.mockImplementation((p) => p === variablesPath);
      fs.readFileSync.mockImplementation((p) => {
        if (p === variablesPath) return minimalVariablesYaml;
        return '';
      });

      await showApp('myapp', { online: false, json: false });

      expect(detectAppType).toHaveBeenCalledWith('myapp');
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Source: offline'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('myapp'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('My Application'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('webapp'));
      expect(getApplication).not.toHaveBeenCalled();
    });

    it('should throw when variables.yaml is not found', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'missing');
      detectAppType.mockResolvedValue({ appPath });
      fs.existsSync.mockReturnValue(false);

      await expect(showApp('missing', {})).rejects.toThrow(/variables\.yaml not found/);
      expect(getApplication).not.toHaveBeenCalled();
    });

    it('should throw when variables.yaml has invalid YAML', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      detectAppType.mockResolvedValue({ appPath });
      const variablesPath = path.join(appPath, 'variables.yaml');
      fs.existsSync.mockImplementation((p) => p === variablesPath);
      fs.readFileSync.mockReturnValue('invalid: yaml: [unclosed');

      await expect(showApp('myapp', {})).rejects.toThrow(/Invalid YAML/);
    });

    it('should output JSON with source offline when --json', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      detectAppType.mockResolvedValue({ appPath });
      const variablesPath = path.join(appPath, 'variables.yaml');
      fs.existsSync.mockImplementation((p) => p === variablesPath);
      fs.readFileSync.mockImplementation((p) => (p === variablesPath ? minimalVariablesYaml : ''));

      await showApp('myapp', { json: true });

      expect(logger.log).toHaveBeenCalledTimes(1);
      const out = JSON.parse(logger.log.mock.calls[0][0]);
      expect(out.source).toBe('offline');
      expect(out.appKey).toBe('myapp');
      expect(out.application).toBeDefined();
      expect(out.application.key).toBe('myapp');
      expect(out.path).toBeDefined();
    });

    it('should require appKey', async() => {
      await expect(showApp('', {})).rejects.toThrow('appKey is required');
      await expect(showApp(null, {})).rejects.toThrow('appKey is required');
    });

    it('should use generated manifest when buildDeploymentManifestInMemory succeeds', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      const deployment = {
        key: 'myapp',
        displayName: 'My App',
        description: 'Desc',
        type: 'webapp',
        deploymentKey: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234',
        image: 'reg/myapp:latest',
        registryMode: 'acr',
        port: 3000,
        healthCheck: { path: '/health', interval: 30 },
        build: { dockerfile: 'Dockerfile', envOutputPath: '.env' },
        roles: [{ name: 'admin', value: 'admin', description: 'Admin role' }],
        permissions: [{ name: 'read', roles: ['admin'], description: 'Read permission' }],
        authentication: { enableSSO: true, type: 'azure', requiredRoles: ['user'] },
        configuration: [],
        databases: [{ name: 'myapp' }]
      };
      generator.buildDeploymentManifestInMemory.mockResolvedValue({ deployment, appPath });

      await showApp('myapp', { online: false, json: false });

      expect(generator.buildDeploymentManifestInMemory).toHaveBeenCalledWith('myapp');
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Source: offline'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('My App'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('admin'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('read'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Authentication'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Databases'));
    });

    it('should output JSON from generated manifest when --json', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      const deployment = {
        key: 'myapp',
        displayName: 'My App',
        type: 'webapp',
        deploymentKey: 'abc123',
        roles: [],
        permissions: [],
        configuration: []
      };
      generator.buildDeploymentManifestInMemory.mockResolvedValue({ deployment, appPath });

      await showApp('myapp', { json: true });

      const out = JSON.parse(logger.log.mock.calls[0][0]);
      expect(out.source).toBe('offline');
      expect(out.appKey).toBe('myapp');
      expect(out.application.deploymentKey).toBeDefined();
    });

    it('should use generated manifest with system.configuration and conditionalConfiguration', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      const deployment = {
        key: 'myapp',
        displayName: 'My App',
        type: 'webapp',
        deploymentKey: 'abc123',
        roles: [],
        permissions: [],
        configuration: undefined,
        system: {
          configuration: [
            { name: 'X', value: 'x', portalInput: { label: 'X', field: 'X' } }
          ],
          conditionalConfiguration: [
            { configuration: [{ name: 'Y', portalInput: { label: 'Y' } }] }
          ]
        }
      };
      generator.buildDeploymentManifestInMemory.mockResolvedValue({ deployment, appPath });

      await showApp('myapp', { online: false, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('📝 Configurations'));
      const logs = logger.log.mock.calls.map((c) => c[0]);
      expect(logs.some((l) => typeof l === 'string' && (l.includes('X') || l.includes('Y')))).toBe(true);
    });

    it('should use generated manifest with requiresDatabase and non-array databases', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      const deployment = {
        key: 'myapp',
        displayName: 'My App',
        type: 'webapp',
        deploymentKey: 'abc123',
        roles: [],
        permissions: [],
        configuration: [],
        databases: undefined,
        requiresDatabase: false
      };
      generator.buildDeploymentManifestInMemory.mockResolvedValue({ deployment, appPath });

      await showApp('myapp', { online: false, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Source: offline'));
    });

    it('should throw when fallback variables.yaml is empty or invalid', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      const variablesPath = path.join(appPath, 'variables.yaml');
      generator.buildDeploymentManifestInMemory.mockRejectedValue(new Error('env.template not found'));
      detectAppType.mockResolvedValue({ appPath });
      fs.existsSync.mockImplementation((p) => p === variablesPath);
      fs.readFileSync.mockReturnValue('');

      await expect(showApp('myapp', {})).rejects.toThrow(/empty or invalid/);
    });

    it('should use variables with conditionalConfiguration and portalInput (masked, field)', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variablesYaml = `
app:
  key: myapp
  displayName: My App
  type: webapp
healthCheck:
  path: /health
  intervalSeconds: 60
configuration:
  - name: SECRET
    value: x
    portalInput:
      label: API Secret
      field: API_SECRET
      masked: true
conditionalConfiguration:
  - configuration:
      - name: EXTRA
        portalInput:
          label: Extra
          field: EXTRA_FIELD
`;
      generator.buildDeploymentManifestInMemory.mockRejectedValue(new Error('no manifest'));
      detectAppType.mockResolvedValue({ appPath });
      fs.existsSync.mockImplementation((p) => p === variablesPath);
      fs.readFileSync.mockImplementation((p) => (p === variablesPath ? variablesYaml : ''));

      await showApp('myapp', { online: false, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Source: offline'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Health:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('interval 60s'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Configurations'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('(masked)'));
    });

    it('should use variables with requiresDatabase and databases', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variablesYaml = `
app:
  key: myapp
  displayName: My App
  type: webapp
requiresDatabase: true
databases:
  - name: myapp
  - name: logs
`;
      generator.buildDeploymentManifestInMemory.mockRejectedValue(new Error('no manifest'));
      detectAppType.mockResolvedValue({ appPath });
      fs.existsSync.mockImplementation((p) => p === variablesPath);
      fs.readFileSync.mockImplementation((p) => (p === variablesPath ? variablesYaml : ''));

      await showApp('myapp', { online: false, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Databases'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('myapp'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('logs'));
    });

    it('should use variables with type external and externalIntegration', async() => {
      const appPath = path.join(process.cwd(), 'builder', 'myapp');
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variablesYaml = `
app:
  key: hubspot
  displayName: HubSpot
  type: external
externalIntegration:
  schemaBasePath: ./
  systems: [hubspot-system.json]
  dataSources: [hubspot-datasource.json]
`;
      generator.buildDeploymentManifestInMemory.mockRejectedValue(new Error('no manifest'));
      detectAppType.mockResolvedValue({ appPath });
      fs.existsSync.mockImplementation((p) => p === variablesPath);
      fs.readFileSync.mockImplementation((p) => (p === variablesPath ? variablesYaml : ''));

      await showApp('hubspot', { online: false, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('External integration'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('hubspot-system.json'));
    });
  });

  describe('online (--online)', () => {
    const { resolveControllerUrl } = require('../../../lib/utils/controller-url');

    beforeEach(() => {
      resolveControllerUrl.mockResolvedValue('http://localhost:3000');
      config.getConfig.mockResolvedValue({
        device: { 'http://localhost:3000': {} }
      });
      config.normalizeControllerUrl.mockImplementation((url) => url || 'http://localhost:3000');
      config.resolveControllerUrl = jest.fn().mockResolvedValue('http://localhost:3000');
      const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });
    });

    it('should fetch from controller and display with Source online', async() => {
      getApplication.mockResolvedValue({
        success: true,
        data: {
          key: 'myapp',
          displayName: 'My Application',
          type: 'webapp',
          status: 'active',
          port: 3000
        }
      });

      await showApp('myapp', { online: true, json: false });

      expect(getApplication).toHaveBeenCalledWith(
        'http://localhost:3000',
        'myapp',
        expect.objectContaining({ type: 'bearer', token: 'test-token' })
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Source: online'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('http://localhost:3000'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('myapp'));
    });

    it('should throw when application not found (404)', async() => {
      getApplication.mockResolvedValue({
        success: false,
        status: 404
      });

      await expect(showApp('nonexistent', { online: true })).rejects.toThrow(
        /Application "nonexistent" not found on controller/
      );
    });

    it('should output JSON with source online when --online --json', async() => {
      getApplication.mockResolvedValue({
        success: true,
        data: {
          key: 'myapp',
          displayName: 'My Application',
          type: 'webapp',
          status: 'active'
        }
      });

      await showApp('myapp', { online: true, json: true });

      expect(logger.log).toHaveBeenCalledTimes(1);
      const out = JSON.parse(logger.log.mock.calls[0][0]);
      expect(out.source).toBe('online');
      expect(out.controllerUrl).toBe('http://localhost:3000');
      expect(out.appKey).toBe('myapp');
      expect(out.application).toBeDefined();
    });

    it('should throw when no auth token (online)', async() => {
      const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
      getOrRefreshDeviceToken.mockResolvedValue(null);
      config.getConfig.mockResolvedValue({ device: {} });

      await expect(showApp('myapp', { online: true })).rejects.toThrow(
        /Authentication required for --online/
      );
    });

    it('should use nested app.configuration when API returns full manifest', async() => {
      getApplication.mockResolvedValue({
        success: true,
        data: {
          key: 'dataplane',
          displayName: 'Dataplane',
          status: 'active',
          url: 'http://127.0.0.1:3611',
          port: 3611,
          configuration: {
            key: 'dataplane',
            displayName: 'Dataplane',
            type: 'webapp',
            deploymentKey: 'a1b2c3d4e5f6',
            image: 'reg/dataplane:latest',
            registryMode: 'acr',
            port: 3611,
            healthCheck: { path: '/health', interval: 30 },
            build: { dockerfile: 'Dockerfile', envOutputPath: '.env' },
            roles: [],
            permissions: [],
            configuration: []
          }
        }
      });

      await showApp('dataplane', { online: true, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Source: online'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('dataplane'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Deployment:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Health:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Build:'));
    });

    it('should format health and build from API (probePath, probeIntervalInSeconds, language, localPort)', async() => {
      getApplication.mockResolvedValue({
        success: true,
        data: {
          key: 'myapp',
          displayName: 'My App',
          type: 'webapp',
          status: 'active',
          configuration: {
            healthCheck: { probePath: '/ready', probeIntervalInSeconds: 45 },
            build: { language: 'node', localPort: 3000 }
          }
        }
      });

      await showApp('myapp', { online: true, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Health:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('/ready'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('45s'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Build:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('node'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('localPort 3000'));
    });

    it('should throw on API error when success is false and status is not 404', async() => {
      const { formatApiError } = require('../../../lib/utils/api-error-handler');
      formatApiError.mockReturnValue('Formatted error');
      getApplication.mockResolvedValue({
        success: false,
        status: 500,
        formattedError: 'Server error'
      });

      await expect(showApp('myapp', { online: true })).rejects.toThrow(
        /Failed to get application from controller/
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should include externalSystem when type is external and dataplane resolves', async() => {
      config.resolveEnvironment = jest.fn().mockResolvedValue('dev');
      const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
      const { getExternalSystemConfig } = require('../../../lib/api/external-systems.api');
      resolveDataplaneUrl.mockResolvedValue('http://dataplane:4000');
      getExternalSystemConfig.mockResolvedValue({
        data: {
          system: { key: 'hubspot', displayName: 'HubSpot', type: 'openapi', status: 'published' },
          dataSources: [{ key: 'contacts', displayName: 'Contacts', systemKey: 'hubspot' }],
          application: { key: 'hubspot', displayName: 'HubSpot', type: 'openapi' }
        }
      });
      getApplication.mockResolvedValue({
        success: true,
        data: {
          key: 'hubspot',
          displayName: 'HubSpot',
          type: 'external',
          configuration: { type: 'external', configuration: [] }
        }
      });

      await showApp('hubspot', { online: true, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('External system (dataplane)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dataplane:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('DataSources:'));
    });

    it('should show externalSystem error when dataplane fails for external type', async() => {
      config.resolveEnvironment = jest.fn().mockResolvedValue('dev');
      const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
      const { getExternalSystemConfig } = require('../../../lib/api/external-systems.api');
      resolveDataplaneUrl.mockResolvedValue('http://dataplane:4000');
      getExternalSystemConfig.mockRejectedValue(new Error('dataplane unreachable'));
      getApplication.mockResolvedValue({
        success: true,
        data: { key: 'hubspot', type: 'external', configuration: { type: 'external', configuration: [] } }
      });

      await showApp('hubspot', { online: true, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('not available'));
    });

    it('should throw when controller URL is not resolved (online)', async() => {
      resolveControllerUrl.mockResolvedValue(null);

      await expect(showApp('myapp', { online: true })).rejects.toThrow(
        /Controller URL is required for --online/
      );
    });

    it('should handle getApplication response without nested .data', async() => {
      getApplication.mockResolvedValue({
        success: true,
        key: 'myapp',
        displayName: 'My App',
        type: 'webapp',
        status: 'active'
      });

      await showApp('myapp', { online: true, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('myapp'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('My App'));
    });

    it('should output JSON with externalSystem when --online --json and type external', async() => {
      config.resolveEnvironment = jest.fn().mockResolvedValue('dev');
      const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
      const { getExternalSystemConfig } = require('../../../lib/api/external-systems.api');
      resolveDataplaneUrl.mockResolvedValue('http://dataplane:4000');
      getExternalSystemConfig.mockResolvedValue({
        data: {
          system: { key: 'hubspot', displayName: 'HubSpot', type: 'openapi', status: 'published' },
          dataSources: [],
          application: { key: 'hubspot', displayName: 'HubSpot', type: 'openapi' }
        }
      });
      getApplication.mockResolvedValue({
        success: true,
        data: {
          key: 'hubspot',
          displayName: 'HubSpot',
          type: 'external',
          configuration: { type: 'external', configuration: [] }
        }
      });

      await showApp('hubspot', { online: true, json: true });

      const out = JSON.parse(logger.log.mock.calls[0][0]);
      expect(out.source).toBe('online');
      expect(out.appKey).toBe('hubspot');
      expect(out.externalSystem).toBeDefined();
      expect(out.externalSystem.error).toBeUndefined();
      expect(out.externalSystem.displayName).toBe('HubSpot');
    });

    it('should output JSON with externalSystem error when dataplane fails and --json', async() => {
      config.resolveEnvironment = jest.fn().mockResolvedValue('dev');
      const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
      const { getExternalSystemConfig } = require('../../../lib/api/external-systems.api');
      resolveDataplaneUrl.mockResolvedValue('http://dataplane:4000');
      getExternalSystemConfig.mockRejectedValue(new Error('timeout'));
      getApplication.mockResolvedValue({
        success: true,
        data: {
          key: 'hubspot',
          type: 'external',
          configuration: { type: 'external', configuration: [] }
        }
      });

      await showApp('hubspot', { online: true, json: true });

      const out = JSON.parse(logger.log.mock.calls[0][0]);
      expect(out.externalSystem).toEqual({ error: expect.any(String) });
    });

    it('should handle listOpenAPIFiles failure and listOpenAPIEndpoints with items shape', async() => {
      config.resolveEnvironment = jest.fn().mockResolvedValue('dev');
      const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
      const { getExternalSystemConfig, listOpenAPIFiles, listOpenAPIEndpoints } = require('../../../lib/api/external-systems.api');
      resolveDataplaneUrl.mockResolvedValue('http://dataplane:4000');
      getExternalSystemConfig.mockResolvedValue({
        data: {
          system: { key: 'hubspot', displayName: 'HubSpot', type: 'openapi', status: 'published' },
          dataSources: [{ key: 'contacts', displayName: 'Contacts', systemKey: 'hubspot' }],
          application: { key: 'hubspot', displayName: 'HubSpot', type: 'openapi' }
        }
      });
      listOpenAPIFiles.mockRejectedValue(new Error('files unreachable'));
      listOpenAPIEndpoints.mockResolvedValue({ items: [{ method: 'GET', path: '/api' }] });
      getApplication.mockResolvedValue({
        success: true,
        data: {
          key: 'hubspot',
          displayName: 'HubSpot',
          type: 'external',
          configuration: { type: 'external', configuration: [] }
        }
      });

      await showApp('hubspot', { online: true, json: false });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('External system (dataplane)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('OpenAPI endpoints'));
    });
  });

  describe('helpers (branch coverage)', () => {
    describe('getPortalInputConfigurations', () => {
      it('should return empty when configuration missing or not array', () => {
        expect(getPortalInputConfigurations({})).toEqual([]);
        expect(getPortalInputConfigurations({ configuration: null })).toEqual([]);
        expect(getPortalInputConfigurations({ configuration: 'not-array' })).toEqual([]);
      });
      it('should use portalInput.field when label and name missing', () => {
        const out = getPortalInputConfigurations({
          configuration: [{ portalInput: { field: 'FIELD_X' }, value: 'v' }]
        });
        expect(out).toEqual([{ label: 'FIELD_X', value: 'v' }]);
      });
      it('should use item.name when portalInput.label missing', () => {
        const out = getPortalInputConfigurations({
          configuration: [{ name: 'ENV_VAR', portalInput: { masked: false }, value: 'v' }]
        });
        expect(out[0].label).toBe('ENV_VAR');
      });
      it('should use (masked) when portalInput.masked is true', () => {
        const out = getPortalInputConfigurations({
          configuration: [{ portalInput: { label: 'Secret', masked: true }, value: 'x' }]
        });
        expect(out[0].value).toBe('(masked)');
      });
      it('should add from conditionalConfiguration blocks', () => {
        const out = getPortalInputConfigurations({
          configuration: [],
          conditionalConfiguration: [
            { configuration: [{ name: 'A', portalInput: { label: 'A' }, value: 'a' }] }
          ]
        });
        expect(out).toHaveLength(1);
        expect(out[0]).toEqual({ label: 'A', value: 'a' });
      });
    });

    describe('formatHealthCheckForDisplay', () => {
      it('should return dash when health is null', () => {
        expect(formatHealthCheckForDisplay(null)).toBe('—');
      });
      it('should use probePath and probeIntervalInSeconds when path/interval missing', () => {
        expect(formatHealthCheckForDisplay({ probePath: '/ready', probeIntervalInSeconds: 45 }))
          .toBe('/ready (interval 45s)');
      });
      it('should return dash when path is dash', () => {
        expect(formatHealthCheckForDisplay({ path: '—' })).toBe('—');
      });
      it('should use health.interval when set', () => {
        expect(formatHealthCheckForDisplay({ path: '/health', interval: 20 }))
          .toBe('/health (interval 20s)');
      });
    });

    describe('formatBuildForDisplay', () => {
      it('should return dash when build is null', () => {
        expect(formatBuildForDisplay(null)).toBe('—');
      });
      it('should return dash when build has no known fields', () => {
        expect(formatBuildForDisplay({})).toBe('—');
      });
      it('should include language and localPort', () => {
        expect(formatBuildForDisplay({ language: 'node', localPort: 3000 }))
          .toBe('node, localPort 3000');
      });
      it('should include only dockerfile when no envOutputPath', () => {
        expect(formatBuildForDisplay({ dockerfile: 'Dockerfile' })).toBe('dockerfile');
      });
      it('should include envOutputPath', () => {
        expect(formatBuildForDisplay({ envOutputPath: '.env' })).toBe('envOutputPath: .env');
      });
    });

    describe('buildOfflineSummaryFromDeployJson', () => {
      it('should use deploy.system.configuration when deploy.configuration missing', () => {
        const deploy = {
          key: 'myapp',
          system: {
            configuration: [{ name: 'X', portalInput: { label: 'X' }, value: 'x' }],
            conditionalConfiguration: []
          }
        };
        const summary = buildOfflineSummaryFromDeployJson(deploy, '/path');
        expect(summary.portalInputConfigurations).toHaveLength(1);
        expect(summary.portalInputConfigurations[0].label).toBe('X');
      });
      it('should use deploy.requiresDatabase and deploy.databases when databases not array', () => {
        const deploy = {
          key: 'myapp',
          requiresDatabase: true,
          databases: [{ name: 'db1' }]
        };
        const summary = buildOfflineSummaryFromDeployJson(deploy, '/path');
        expect(summary.databases).toEqual(['db1']);
      });
      it('should set databases to [] when not array and requiresDatabase false', () => {
        const deploy = { key: 'myapp', databases: undefined, requiresDatabase: false };
        const summary = buildOfflineSummaryFromDeployJson(deploy, '/path');
        expect(summary.databases).toEqual([]);
      });
      it('should not truncate short deploymentKey', () => {
        const deploy = { key: 'myapp', deploymentKey: 'short' };
        const summary = buildOfflineSummaryFromDeployJson(deploy, '/path');
        expect(summary.application.deploymentKey).toBe('short');
      });
      it('should format health without path as dash', () => {
        const deploy = { key: 'myapp', healthCheck: { interval: 30 } };
        const summary = buildOfflineSummaryFromDeployJson(deploy, '/path');
        expect(summary.application.healthCheck).toBe('—');
      });
    });

    describe('buildOfflineSummary', () => {
      it('should use health.intervalSeconds', () => {
        const variables = {
          app: { key: 'myapp', displayName: 'My App', type: 'webapp' },
          healthCheck: { path: '/health', intervalSeconds: 60 }
        };
        const summary = buildOfflineSummary(variables, '/path');
        expect(summary.application.healthCheck).toContain('60s');
      });
      it('should include externalIntegration when type external', () => {
        const variables = {
          app: { key: 'ext', type: 'external' },
          externalIntegration: { schemaBasePath: './', systems: [], dataSources: [] }
        };
        const summary = buildOfflineSummary(variables, '/path');
        expect(summary.application.externalIntegration).toBeDefined();
        expect(summary.isExternal).toBe(true);
      });
      it('should include databases when requiresDatabase and databases set', () => {
        const variables = {
          app: { key: 'myapp' },
          requiresDatabase: true,
          databases: [{ name: 'mydb' }]
        };
        const summary = buildOfflineSummary(variables, '/path');
        expect(summary.databases).toEqual(['mydb']);
      });
    });

    describe('buildOnlineSummary', () => {
      it('should handle apiApp with data wrapper', () => {
        const apiApp = { data: { key: 'myapp', displayName: 'My App', type: 'webapp' } };
        const summary = buildOnlineSummary(apiApp, 'http://controller', null);
        expect(summary.application.key).toBe('myapp');
        expect(summary.source).toBe('online');
      });
      it('should set externalSystem error when externalSystem has error', () => {
        const apiApp = { key: 'myapp', type: 'webapp' };
        const summary = buildOnlineSummary(apiApp, 'http://c', { error: 'unreachable' });
        expect(summary.externalSystem).toEqual({ error: 'unreachable' });
      });
      it('should set externalSystem to null when externalSystem null', () => {
        const apiApp = { key: 'myapp', type: 'webapp' };
        const summary = buildOnlineSummary(apiApp, 'http://c', null);
        expect(summary.externalSystem).toBeNull();
      });
      it('should use cfg.configuration when app.configuration is object', () => {
        const apiApp = {
          key: 'myapp',
          configuration: {
            configuration: [{ name: 'X', portalInput: { label: 'X' }, value: 'v' }],
            conditionalConfiguration: []
          }
        };
        const summary = buildOnlineSummary(apiApp, 'http://c', null);
        expect(summary.portalInputConfigurations).toHaveLength(1);
        expect(summary.portalInputConfigurations[0].label).toBe('X');
      });
      it('should use app.databases when cfg.databases not array', () => {
        const apiApp = {
          key: 'myapp',
          type: 'webapp',
          configuration: {},
          databases: [{ name: 'mydb' }]
        };
        const summary = buildOnlineSummary(apiApp, 'http://c', null);
        expect(summary.databases).toEqual([{ name: 'mydb' }]);
      });
      it('should include externalIntegration when type external and extInt set', () => {
        const apiApp = {
          key: 'ext',
          type: 'external',
          configuration: {
            externalIntegration: { schemaBasePath: './', systems: ['s'], dataSources: ['d'] }
          }
        };
        const summary = buildOnlineSummary(apiApp, 'http://c', null);
        expect(summary.application.externalIntegration).toBeDefined();
        expect(summary.application.externalIntegration.schemaBasePath).toBe('./');
      });
      it('should treat non-object app.configuration as empty cfg', () => {
        const apiApp = { key: 'myapp', displayName: 'My App', type: 'webapp', configuration: null };
        const summary = buildOnlineSummary(apiApp, 'http://c', null);
        expect(summary.application.key).toBe('myapp');
        expect(summary.portalInputConfigurations).toEqual([]);
      });
      it('should use condConfig when not array as empty', () => {
        const apiApp = {
          key: 'myapp',
          configuration: { configuration: [], conditionalConfiguration: {} }
        };
        const summary = buildOnlineSummary(apiApp, 'http://c', null);
        expect(summary.portalInputConfigurations).toEqual([]);
      });
    });

    describe('buildOfflineSummaryFromDeployJson', () => {
      it('should use deploy.system.conditionalConfiguration when not array as empty', () => {
        const deploy = {
          key: 'myapp',
          configuration: undefined,
          system: {
            configuration: [],
            conditionalConfiguration: null
          }
        };
        const summary = buildOfflineSummaryFromDeployJson(deploy, '/path');
        expect(summary.portalInputConfigurations).toEqual([]);
      });
    });

    describe('getPortalInputConfigurations skips items without portalInput', () => {
      it('should not add items without portalInput', () => {
        const out = getPortalInputConfigurations({
          configuration: [
            { name: 'NoPortal', value: 'x' },
            { name: 'WithPortal', portalInput: { label: 'With' }, value: 'y' }
          ]
        });
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe('With');
      });
    });

    describe('getShowAuthToken', () => {
      it('should use config.device when controllerUrl is falsy and return first valid token', async() => {
        const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
        getOrRefreshDeviceToken
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ token: 'device-token', controller: 'http://second:3000' });
        config.normalizeControllerUrl.mockImplementation((url) => url || 'http://localhost:3000');
        const result = await getShowAuthToken(null, {
          device: {
            'http://first:3000': {},
            'http://second:3000': {}
          }
        });
        expect(result).toEqual({ token: 'device-token', actualControllerUrl: 'http://second:3000' });
      });
    });
  });
});
