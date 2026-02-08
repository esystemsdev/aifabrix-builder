/**
 * Tests for deployment list commands
 *
 * @fileoverview Unit tests for commands/deployment-list.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = (t) => t;
  mockChalk.gray = (t) => t;
  mockChalk.cyan = (t) => t;
  mockChalk.bold = (t) => t;
  return mockChalk;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn()
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));

jest.mock('../../../lib/core/config', () => ({
  resolveEnvironment: jest.fn().mockResolvedValue('dev'),
  normalizeControllerUrl: jest.fn((url) => (url ? url.replace(/\/$/, '') : url))
}));

jest.mock('../../../lib/api/deployments.api', () => ({
  listDeployments: jest.fn(),
  listApplicationDeployments: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { listDeployments, listApplicationDeployments } = require('../../../lib/api/deployments.api');
const {
  runDeploymentList,
  runAppDeploymentList
} = require('../../../lib/commands/deployment-list');

describe('Deployment list commands', () => {
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({
      token: 'test-token',
      controller: 'https://controller.example.com'
    });
    listDeployments.mockResolvedValue({
      data: { items: [{ id: 'd1', applicationKey: 'myapp', status: 'completed' }] }
    });
    listApplicationDeployments.mockResolvedValue({
      data: { items: [{ id: 'd1', status: 'completed', createdAt: '2024-01-01' }] }
    });
  });

  afterAll(() => {
    exitSpy.mockRestore();
  });

  describe('runDeploymentList', () => {
    it('should list deployments and display them', async() => {
      await runDeploymentList({});

      expect(listDeployments).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        { type: 'bearer', token: 'test-token' },
        expect.objectContaining({ pageSize: 50 })
      );
      expect(logger.log).toHaveBeenCalled();
      expect(logger.log.mock.calls.some(c => String(c[0]).includes('Deployments'))).toBe(true);
    });

    it('should exit when no controller URL', async() => {
      resolveControllerUrl.mockResolvedValue(null);

      await expect(runDeploymentList({})).rejects.toThrow('process.exit(1)');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Controller URL is required'));
      expect(listDeployments).not.toHaveBeenCalled();
    });

    it('should exit when no auth token', async() => {
      getOrRefreshDeviceToken.mockResolvedValue(null);

      await expect(runDeploymentList({})).rejects.toThrow('process.exit(1)');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No authentication token'));
    });

    it('should exit on API error', async() => {
      listDeployments.mockRejectedValue(new Error('API error'));

      await expect(runDeploymentList({})).rejects.toThrow('process.exit(1)');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to list deployments'));
    });

    it('should display empty message when no deployments', async() => {
      listDeployments.mockResolvedValue({ data: { items: [] } });

      await runDeploymentList({});

      expect(logger.log.mock.calls.some(c => String(c[0]).includes('No deployments found'))).toBe(true);
    });

    it('should use environment option when provided', async() => {
      await runDeploymentList({ environment: 'prod' });

      expect(listDeployments).toHaveBeenCalledWith(
        expect.any(String),
        'prod',
        expect.objectContaining({ type: 'bearer' }),
        expect.objectContaining({ pageSize: 50 })
      );
    });

    it('should handle response with data.deployments', async() => {
      listDeployments.mockResolvedValue({
        data: {
          deployments: [
            { id: 'dep-1', applicationKey: 'app1', status: 'completed', createdAt: '2024-01-01' }
          ]
        }
      });

      await runDeploymentList({});

      expect(logger.log).toHaveBeenCalled();
      expect(logger.log.mock.calls.some(c => String(c[0]).includes('dep-1'))).toBe(true);
    });
  });

  describe('runAppDeploymentList', () => {
    it('should list app deployments and display them', async() => {
      await runAppDeploymentList('myapp', {});

      expect(listApplicationDeployments).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'myapp',
        { type: 'bearer', token: 'test-token' },
        expect.objectContaining({ pageSize: 50 })
      );
      expect(logger.log).toHaveBeenCalled();
      expect(logger.log.mock.calls.some(c => String(c[0]).includes('myapp'))).toBe(true);
    });

    it('should exit when appKey is missing', async() => {
      await expect(runAppDeploymentList('', {})).rejects.toThrow('process.exit(1)');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Application key is required'));
      expect(listApplicationDeployments).not.toHaveBeenCalled();
    });

    it('should exit when no controller URL', async() => {
      resolveControllerUrl.mockResolvedValue(null);

      await expect(runAppDeploymentList('myapp', {})).rejects.toThrow('process.exit(1)');
      expect(listApplicationDeployments).not.toHaveBeenCalled();
    });

    it('should exit on API error', async() => {
      listApplicationDeployments.mockRejectedValue(new Error('Not found'));

      await expect(runAppDeploymentList('myapp', {})).rejects.toThrow('process.exit(1)');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to list deployments'));
    });

    it('should pass pageSize option to listApplicationDeployments', async() => {
      await runAppDeploymentList('myapp', { pageSize: 25 });

      expect(listApplicationDeployments).toHaveBeenCalledWith(
        expect.any(String),
        'dev',
        'myapp',
        expect.objectContaining({ type: 'bearer' }),
        expect.objectContaining({ pageSize: 25 })
      );
    });

    it('should use environment option when provided', async() => {
      await runAppDeploymentList('myapp', { environment: 'prod' });

      expect(listApplicationDeployments).toHaveBeenCalledWith(
        expect.any(String),
        'prod',
        'myapp',
        expect.objectContaining({ type: 'bearer' }),
        expect.objectContaining({ pageSize: 50 })
      );
    });
  });
});
