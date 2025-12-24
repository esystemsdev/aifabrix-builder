/**
 * Tests for Auth API
 *
 * @fileoverview Tests for lib/api/auth.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock ApiClient before requiring auth.api
const mockClient = {
  get: jest.fn(),
  post: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => {
  return {
    baseUrl,
    authConfig,
    get: mockClient.get,
    post: mockClient.post
  };
});

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient
}));

const authApi = require('../../../lib/api/auth.api');

describe('Auth API', () => {
  const controllerUrl = 'https://api.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: {} });
    mockClient.post.mockResolvedValue({ success: true, data: {} });
  });

  describe('getToken', () => {
    it('should get token using client credentials', async() => {
      const result = await authApi.getToken('client-id', 'client-secret', controllerUrl);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/token');
      expect(result.success).toBe(true);
    });
  });

  describe('getClientToken', () => {
    it('should get client token using POST', async() => {
      await authApi.getClientToken(controllerUrl, 'POST');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/client-token');
    });

    it('should get client token using GET', async() => {
      await authApi.getClientToken(controllerUrl, 'GET');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/client-token');
    });

    it('should default to POST', async() => {
      await authApi.getClientToken(controllerUrl);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/client-token');
    });
  });

  describe('getAuthUser', () => {
    it('should get current user info', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.getAuthUser(controllerUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/user');
    });
  });

  describe('getAuthLogin', () => {
    it('should get login URL with redirect and state', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.getAuthLogin(controllerUrl, 'https://redirect.com', 'state-123', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/login', {
        params: { redirect: 'https://redirect.com', state: 'state-123' }
      });
    });

    it('should get login URL without state', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.getAuthLogin(controllerUrl, 'https://redirect.com', undefined, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/login', {
        params: { redirect: 'https://redirect.com', state: undefined }
      });
    });
  });

  describe('initiateDeviceCodeFlow', () => {
    it('should initiate device code flow with environment in query', async() => {
      await authApi.initiateDeviceCodeFlow(controllerUrl, 'dev', 'openid profile');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/login', {
        params: { environment: 'dev', scope: 'openid profile' }
      });
    });

    it('should initiate device code flow with environment only', async() => {
      await authApi.initiateDeviceCodeFlow(controllerUrl, 'dev');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/login', {
        params: { environment: 'dev' }
      });
    });

    it('should initiate device code flow without environment', async() => {
      await authApi.initiateDeviceCodeFlow(controllerUrl);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/login', {
        body: undefined
      });
    });

    it('should initiate device code flow with scope in body', async() => {
      await authApi.initiateDeviceCodeFlow(controllerUrl, undefined, 'openid profile');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/login', {
        body: { scope: 'openid profile' }
      });
    });
  });

  describe('pollDeviceCodeToken', () => {
    it('should poll for device code token', async() => {
      await authApi.pollDeviceCodeToken('device-code-123', controllerUrl);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/login/device/token', {
        body: { deviceCode: 'device-code-123' }
      });
    });
  });

  describe('refreshDeviceToken', () => {
    it('should refresh device token', async() => {
      await authApi.refreshDeviceToken('refresh-token-123', controllerUrl);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/login/device/refresh', {
        body: { refreshToken: 'refresh-token-123' }
      });
    });
  });

  describe('refreshUserToken', () => {
    it('should refresh user token', async() => {
      await authApi.refreshUserToken('refresh-token-123', controllerUrl);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/refresh', {
        body: { refreshToken: 'refresh-token-123' }
      });
    });
  });

  describe('validateToken', () => {
    it('should validate token', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.validateToken('token-123', controllerUrl, authConfig);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/validate', {
        body: { token: 'token-123' }
      });
    });

    it('should validate token with environment and application', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.validateToken('token-123', controllerUrl, authConfig, 'dev', 'app-key');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/auth/validate', {
        body: { token: 'token-123', environment: 'dev', application: 'app-key' }
      });
    });
  });

  describe('getAuthRoles', () => {
    it('should get user roles', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.getAuthRoles(controllerUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/roles', {
        params: { environment: undefined, application: undefined }
      });
    });

    it('should get user roles with filters', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.getAuthRoles(controllerUrl, authConfig, 'dev', 'app-key');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/roles', {
        params: { environment: 'dev', application: 'app-key' }
      });
    });
  });

  describe('refreshAuthRoles', () => {
    it('should refresh user roles', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.refreshAuthRoles(controllerUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/roles/refresh');
    });
  });

  describe('getAuthPermissions', () => {
    it('should get user permissions', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.getAuthPermissions(controllerUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/permissions', {
        params: { environment: undefined, application: undefined }
      });
    });
  });

  describe('refreshAuthPermissions', () => {
    it('should refresh user permissions', async() => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      await authApi.refreshAuthPermissions(controllerUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/permissions/refresh');
    });
  });

  describe('getAuthLoginDiagnostics', () => {
    it('should get login diagnostics', async() => {
      await authApi.getAuthLoginDiagnostics(controllerUrl);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/login/diagnostics', {
        params: { environment: undefined }
      });
    });

    it('should get login diagnostics with environment', async() => {
      await authApi.getAuthLoginDiagnostics(controllerUrl, 'dev');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/auth/login/diagnostics', {
        params: { environment: 'dev' }
      });
    });
  });
});

