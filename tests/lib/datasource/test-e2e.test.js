/**
 * Tests for Datasource Test E2E
 * @fileoverview Tests for lib/datasource/test-e2e.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/api/external-test.api');
jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((app) => `/integration/${app}`),
  resolveIntegrationAppKeyFromCwd: jest.fn()
}));
jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('https://controller.example.com')
}));
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeviceOnlyAuth: jest.fn()
}));
jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn().mockResolvedValue('https://dataplane.example.com')
}));
jest.mock('../../../lib/utils/test-log-writer', () => ({
  writeTestLog: jest.fn().mockResolvedValue('/path/to/log.json')
}));
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { runDatasourceTestE2E, resolveAppKey } = require('../../../lib/datasource/test-e2e');
const externalTestApi = require('../../../lib/api/external-test.api');
const paths = require('../../../lib/utils/paths');
const tokenManager = require('../../../lib/utils/token-manager');

describe('Datasource Test E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paths.resolveIntegrationAppKeyFromCwd.mockReturnValue(null);
    tokenManager.getDeviceOnlyAuth.mockResolvedValue({ type: 'bearer', token: 'test-token' });
    externalTestApi.testDatasourceE2E.mockResolvedValue({
      success: true,
      data: { steps: [{ name: 'config', success: true }] }
    });
  });

  describe('resolveAppKey', () => {
    it('should return explicit app key', () => {
      expect(resolveAppKey('myapp')).toBe('myapp');
    });

    it('should resolve from cwd when no --app', () => {
      paths.resolveIntegrationAppKeyFromCwd.mockReturnValue('from-cwd');
      expect(resolveAppKey()).toBe('from-cwd');
    });

    it('should throw when no context', () => {
      paths.resolveIntegrationAppKeyFromCwd.mockReturnValue(null);
      expect(() => resolveAppKey()).toThrow('Could not determine app context');
    });
  });

  describe('runDatasourceTestE2E', () => {
    it('should throw when datasourceKey is missing', async() => {
      await expect(runDatasourceTestE2E('', { app: 'myapp' })).rejects.toThrow('Datasource key is required');
    });

    it('should call external E2E API with datasource key', async() => {
      const result = await runDatasourceTestE2E('hubspot-contacts', { app: 'myapp' });

      expect(externalTestApi.testDatasourceE2E).toHaveBeenCalledWith(
        'https://dataplane.example.com',
        'hubspot-contacts',
        expect.objectContaining({ token: 'test-token' }),
        {}
      );
      expect(result.steps).toHaveLength(1);
    });
  });
});
