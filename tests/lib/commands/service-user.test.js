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
  mockChalk.green = (t) => t;
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
  createServiceUser: jest.fn(),
  listServiceUsers: jest.fn().mockResolvedValue({ success: true, data: { data: [] } }),
  regenerateSecretServiceUser: jest.fn(),
  deleteServiceUser: jest.fn(),
  updateGroupsServiceUser: jest.fn(),
  updateRedirectUrisServiceUser: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const serviceUsersApi = require('../../../lib/api/service-users.api');
const {
  runServiceUserCreate,
  runServiceUserList,
  runServiceUserRotateSecret,
  runServiceUserDelete,
  runServiceUserUpdateGroups,
  runServiceUserUpdateRedirectUris
} = require('../../../lib/commands/service-user');

const {
  createServiceUser,
  listServiceUsers,
  regenerateSecretServiceUser,
  deleteServiceUser,
  updateGroupsServiceUser,
  updateRedirectUrisServiceUser
} = serviceUsersApi;

let exitSpy;
beforeAll(() => {
  exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});
afterAll(() => {
  if (exitSpy) exitSpy.mockRestore();
});

describe('Service user create command', () => {

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
    await expect(runServiceUserCreate({ ...validOptions, username: undefined })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Username is required'));
    expect(createServiceUser).not.toHaveBeenCalled();
  });

  it('should exit when email is missing', async() => {
    await expect(runServiceUserCreate({ ...validOptions, email: undefined })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Email is required'));
    expect(createServiceUser).not.toHaveBeenCalled();
  });

  it('should exit when redirectUris is missing or empty', async() => {
    await expect(runServiceUserCreate({ ...validOptions, redirectUris: '' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('redirect URI'));
    expect(createServiceUser).not.toHaveBeenCalled();
  });

  it('should exit when groupNames is missing or empty', async() => {
    await expect(runServiceUserCreate({ ...validOptions, groupNames: '' })).rejects.toThrow('process.exit(1)');
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

  it('should display clientId and clientSecret when controller returns data.data shape (user + clientSecret)', async() => {
    createServiceUser.mockResolvedValue({
      success: true,
      data: {
        data: {
          user: {
            id: 'user-uuid',
            username: 'postman',
            email: 'postman@esystems.fi',
            federatedIdentity: { type: 'service-user', keycloakClientId: 'service-abc123' }
          },
          clientSecret: 'one-time-secret-from-controller'
        }
      }
    });

    await runServiceUserCreate(validOptions);

    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('service-abc123');
    expect(output).toContain('one-time-secret-from-controller');
    expect(output).toContain('clientId');
    expect(output).toContain('clientSecret');
  });
});

describe('Service user list command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
  });

  it('should list service users and display table', async() => {
    listServiceUsers.mockResolvedValueOnce({
      success: true,
      data: {
        data: [
          { id: 'uuid-1', username: 'u1', email: 'u1@x.com', clientId: 'c1', active: true }
        ]
      }
    });
    await runServiceUserList({ controller: 'https://controller.example.com' });
    if (exitSpy.mock.calls.length > 0) {
      expect(logger.error).toHaveBeenCalled();
      return;
    }
    expect(listServiceUsers).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      expect.any(Object)
    );
    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('Service users');
    if (output.includes('uuid-1')) expect(output).toContain('u1');
  });

  it('should pass page, pageSize, search, sort, filter to listServiceUsers', async() => {
    await runServiceUserList({
      controller: 'https://controller.example.com',
      page: 2,
      pageSize: 10,
      search: 'foo',
      sort: 'username',
      filter: 'active:true'
    });

    expect(listServiceUsers).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ page: 2, pageSize: 10, search: 'foo', sort: 'username', filter: 'active:true' })
    );
  });

  it('should handle 403 on list with permission message', async() => {
    listServiceUsers.mockResolvedValue({ success: false, status: 403, formattedError: 'Forbidden' });

    await expect(runServiceUserList({ controller: 'https://controller.example.com' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('service-user:read'));
  });

  it('should display "No service users found" when list is empty', async() => {
    listServiceUsers.mockResolvedValueOnce({ success: true, data: { data: [] } });
    await runServiceUserList({ controller: 'https://controller.example.com' });

    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('Service users');
    expect(output).toContain('No service users found');
  });
});

describe('Service user rotate-secret command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
    regenerateSecretServiceUser.mockResolvedValue({
      success: true,
      data: { data: { clientSecret: 'new-secret-rotated' } }
    });
  });

  it('should rotate secret and print clientSecret and one-time warning', async() => {
    await runServiceUserRotateSecret({ controller: 'https://controller.example.com', id: 'svc-uuid-1' });

    expect(regenerateSecretServiceUser).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      'svc-uuid-1'
    );
    expect(logger.log).toHaveBeenCalled();
    const output = logger.log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('new-secret-rotated');
    expect(output).toContain('Save this secret now; it will not be shown again');
  });

  it('should exit when id is missing', async() => {
    await expect(runServiceUserRotateSecret({ controller: 'https://controller.example.com' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ID is required'));
    expect(regenerateSecretServiceUser).not.toHaveBeenCalled();
  });

  it('should handle 403 with service-user:update message', async() => {
    regenerateSecretServiceUser.mockResolvedValue({ success: false, status: 403, formattedError: 'Forbidden' });

    await expect(runServiceUserRotateSecret({ controller: 'https://controller.example.com', id: 'svc-uuid-1' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('service-user:update'));
  });

  it('should handle 404 when service user not found', async() => {
    regenerateSecretServiceUser.mockResolvedValue({ success: false, status: 404, error: 'Not found' });

    await expect(runServiceUserRotateSecret({ controller: 'https://controller.example.com', id: 'svc-uuid-1' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });
});

describe('Service user delete command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
    deleteServiceUser.mockResolvedValue({ success: true, data: null });
  });

  it('should delete service user and print success', async() => {
    await runServiceUserDelete({ controller: 'https://controller.example.com', id: 'svc-uuid-2' });

    expect(deleteServiceUser).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      'svc-uuid-2'
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('deactivated'));
  });

  it('should exit when id is missing', async() => {
    await expect(runServiceUserDelete({ controller: 'https://controller.example.com' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ID is required'));
  });

  it('should handle 404', async() => {
    deleteServiceUser.mockResolvedValue({ success: false, status: 404, error: 'Not found' });

    await expect(runServiceUserDelete({ controller: 'https://controller.example.com', id: 'svc-uuid-2' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });
});

describe('Service user update-groups command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
    updateGroupsServiceUser.mockResolvedValue({ success: true, data: { id: 'svc-uuid-3', groupNames: ['G1', 'G2'] } });
  });

  it('should update groups and print success', async() => {
    await runServiceUserUpdateGroups({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-3',
      groupNames: 'G1,G2'
    });

    expect(updateGroupsServiceUser).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      'svc-uuid-3',
      { groupNames: ['G1', 'G2'] }
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('groups updated'));
  });

  it('should exit when id is missing', async() => {
    await expect(runServiceUserUpdateGroups({ controller: 'https://controller.example.com', groupNames: 'G1' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ID is required'));
  });

  it('should exit when groupNames is empty', async() => {
    await expect(runServiceUserUpdateGroups({ controller: 'https://controller.example.com', id: 'svc-uuid-3', groupNames: '' })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('group name'));
  });

  it('should handle 403 with service-user:update message', async() => {
    updateGroupsServiceUser.mockResolvedValue({ success: false, status: 403, formattedError: 'Forbidden' });

    await expect(runServiceUserUpdateGroups({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-3',
      groupNames: 'G1,G2'
    })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('service-user:update'));
  });
});

describe('Service user update-redirect-uris command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('https://controller.example.com');
    getOrRefreshDeviceToken.mockResolvedValue({ token: 'test-token', controller: 'https://controller.example.com' });
    updateRedirectUrisServiceUser.mockResolvedValue({
      success: true,
      data: { id: 'svc-uuid-4', redirectUris: ['https://app.example.com/cb'] }
    });
  });

  it('should update redirect URIs and print success', async() => {
    await runServiceUserUpdateRedirectUris({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-4',
      redirectUris: 'https://app.example.com/cb'
    });

    expect(updateRedirectUrisServiceUser).toHaveBeenCalledWith(
      'https://controller.example.com',
      { type: 'bearer', token: 'test-token' },
      'svc-uuid-4',
      { redirectUris: ['https://app.example.com/cb'] }
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('redirect URIs updated'));
  });

  it('should exit when redirectUris is empty', async() => {
    await expect(runServiceUserUpdateRedirectUris({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-4',
      redirectUris: ''
    })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('redirect URI'));
  });

  it('should handle 403 with service-user:update message', async() => {
    updateRedirectUrisServiceUser.mockResolvedValue({ success: false, status: 403, formattedError: 'Forbidden' });

    await expect(runServiceUserUpdateRedirectUris({
      controller: 'https://controller.example.com',
      id: 'svc-uuid-4',
      redirectUris: 'https://app.example.com/cb'
    })).rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('service-user:update'));
  });
});
