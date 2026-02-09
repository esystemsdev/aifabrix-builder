/**
 * Tests for service-user create command
 *
 * @fileoverview Unit tests for commands/service-user.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = (t) => t;
  mockChalk.gray = (t) => t;
  mockChalk.cyan = (t) => t;
  mockChalk.bold = (t) => t;
  mockChalk.yellow = (t) => t;
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
  normalizeControllerUrl: jest.fn((url) => (url ? url.replace(/\/$/, '') : url))
}));

jest.mock('../../../lib/api/service-users.api', () => ({
  createServiceUser: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { createServiceUser } = require('../../../lib/api/service-users.api');
const { runServiceUserCreate } = require('../../../lib/commands/service-user');

describe('Service user create command', () => {
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
    createServiceUser.mockResolvedValue({
      success: true,
      data: { clientId: 'svc-id-1', clientSecret: 'one-time-secret-value' }
    });
  });

  afterAll(() => {
    exitSpy.mockRestore();
  });

  const validOptions = {
    username: 'api-client-001',
    email: 'api@example.com',
    redirectUris: 'https://app.example.com/callback',
    groupNames: 'AI-Fabrix-Developers'
  };

  it('should create service user and print clientId, clientSecret, and one-time warning', async() => {
    await runServiceUserCreate(validOptions);

    expect(createServiceUser).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      expect.objectContaining({
        username: 'api-client-001',
        email: 'api@example.com',
        redirectUris: ['https://app.example.com/callback'],
        groupNames: ['AI-Fabrix-Developers']
      })
    );
    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('clientId');
    expect(output).toContain('clientSecret');
    expect(output).toContain('svc-id-1');
    expect(output).toContain('Save this secret now; it will not be shown again');
  });

  it('should exit when username is missing', async() => {
    await expect(runServiceUserCreate({ ...validOptions, username: undefined })).rejects.toThrow(
      'process.exit(1)'
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Username is required'));
    expect(createServiceUser).not.toHaveBeenCalled();
  });

  it('should exit when email is missing', async() => {
    await expect(runServiceUserCreate({ ...validOptions, email: undefined })).rejects.toThrow(
      'process.exit(1)'
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Email is required'));
    expect(createServiceUser).not.toHaveBeenCalled();
  });

  it('should exit when redirectUris is missing or empty', async() => {
    await expect(runServiceUserCreate({ ...validOptions, redirectUris: '' })).rejects.toThrow(
      'process.exit(1)'
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('redirect URI'));
    expect(createServiceUser).not.toHaveBeenCalled();
  });

  it('should exit when groupNames is missing or empty', async() => {
    await expect(runServiceUserCreate({ ...validOptions, groupNames: '' })).rejects.toThrow(
      'process.exit(1)'
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('group name'));
    expect(createServiceUser).not.toHaveBeenCalled();
  });

  it('should exit when controller URL is missing', async() => {
    resolveControllerUrl.mockResolvedValue(null);

    await expect(runServiceUserCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Controller URL is required'));
    expect(createServiceUser).not.toHaveBeenCalled();
  });

  it('should exit when no auth token', async() => {
    getOrRefreshDeviceToken.mockResolvedValue(null);

    await expect(runServiceUserCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No authentication token'));
    expect(createServiceUser).not.toHaveBeenCalled();
  });

  it('should handle 403 with permission message', async() => {
    createServiceUser.mockResolvedValue({
      success: false,
      status: 403,
      formattedError: 'Forbidden'
    });

    await expect(runServiceUserCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Missing permission: service-user:create')
    );
  });

  it('should handle 400 validation error', async() => {
    createServiceUser.mockResolvedValue({
      success: false,
      status: 400,
      error: 'username is required'
    });

    await expect(runServiceUserCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Validation error'));
  });

  it('should handle 401 unauthorized', async() => {
    createServiceUser.mockResolvedValue({
      success: false,
      status: 401,
      error: 'Unauthorized'
    });

    await expect(runServiceUserCreate(validOptions)).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unauthorized'));
  });

  it('should pass description and parse comma-separated redirectUris and groupNames', async() => {
    await runServiceUserCreate({
      ...validOptions,
      description: 'For pipelines',
      redirectUris: 'https://a.com/cb,https://b.com/cb',
      groupNames: 'AI-Fabrix-Developers,my-api-group'
    });

    expect(createServiceUser).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        username: 'api-client-001',
        email: 'api@example.com',
        description: 'For pipelines',
        redirectUris: ['https://a.com/cb', 'https://b.com/cb'],
        groupNames: ['AI-Fabrix-Developers', 'my-api-group']
      })
    );
  });
});
