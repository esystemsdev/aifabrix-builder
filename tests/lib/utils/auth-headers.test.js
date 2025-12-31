/**
 * Authentication Headers Utilities Tests
 *
 * Comprehensive unit tests for authentication header creation functions
 *
 * @fileoverview Tests for auth-headers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const authHeaders = require('../../../lib/utils/auth-headers');

describe('Authentication Headers Utilities', () => {
  describe('createBearerTokenHeaders', () => {
    it('should create headers with bearer token', () => {
      const headers = authHeaders.createBearerTokenHeaders('test-token-123');
      expect(headers).toEqual({
        'Authorization': 'Bearer test-token-123'
      });
    });

    it('should create headers with different token values', () => {
      const headers1 = authHeaders.createBearerTokenHeaders('token1');
      const headers2 = authHeaders.createBearerTokenHeaders('token2');

      expect(headers1['Authorization']).toBe('Bearer token1');
      expect(headers2['Authorization']).toBe('Bearer token2');
    });

    it('should throw error when token is missing', () => {
      expect(() => {
        authHeaders.createBearerTokenHeaders(null);
      }).toThrow('Authentication token is required');
    });

    it('should throw error when token is undefined', () => {
      expect(() => {
        authHeaders.createBearerTokenHeaders(undefined);
      }).toThrow('Authentication token is required');
    });

    it('should throw error when token is empty string', () => {
      expect(() => {
        authHeaders.createBearerTokenHeaders('');
      }).toThrow('Authentication token is required');
    });

    it('should accept whitespace-only token (no validation)', () => {
      // Note: Function doesn't validate whitespace, only checks for falsy values
      const headers = authHeaders.createBearerTokenHeaders('   ');
      expect(headers['Authorization']).toBe('Bearer    ');
    });
  });

  describe('createClientCredentialsHeaders', () => {
    it('should create headers with client ID and secret', () => {
      const headers = authHeaders.createClientCredentialsHeaders('test-client-id', 'test-secret');
      expect(headers).toEqual({
        'x-client-id': 'test-client-id',
        'x-client-secret': 'test-secret'
      });
    });

    it('should create headers with different credential values', () => {
      const headers = authHeaders.createClientCredentialsHeaders('id-123', 'secret-456');
      expect(headers['x-client-id']).toBe('id-123');
      expect(headers['x-client-secret']).toBe('secret-456');
    });

    it('should throw error when client ID is missing', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders(null, 'secret');
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client secret is missing', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders('client-id', null);
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when both credentials are missing', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders(null, null);
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client ID is undefined', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders(undefined, 'secret');
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client secret is undefined', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders('client-id', undefined);
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client ID is empty string', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders('', 'secret');
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client secret is empty string', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders('client-id', '');
      }).toThrow('Client ID and Client Secret are required');
    });
  });

  describe('createAuthHeaders', () => {
    it('should create bearer token headers when type is bearer', () => {
      const authConfig = { type: 'bearer', token: 'test-token-123' };
      const headers = authHeaders.createAuthHeaders(authConfig);
      expect(headers['Authorization']).toBe('Bearer test-token-123');
    });

    it('should create client credentials headers when type is client-credentials', () => {
      const authConfig = { type: 'client-credentials', clientId: 'test-id', clientSecret: 'test-secret' };
      const headers = authHeaders.createAuthHeaders(authConfig);
      expect(headers['x-client-id']).toBe('test-id');
      expect(headers['x-client-secret']).toBe('test-secret');
    });

    it('should throw error when auth config is missing', () => {
      expect(() => {
        authHeaders.createAuthHeaders(null);
      }).toThrow('Authentication configuration is required');
    });

    it('should throw error when auth config is undefined', () => {
      expect(() => {
        authHeaders.createAuthHeaders(undefined);
      }).toThrow('Authentication configuration is required');
    });

    it('should throw error when auth type is missing', () => {
      expect(() => {
        authHeaders.createAuthHeaders({});
      }).toThrow('Authentication configuration is required');
    });

    it('should throw error when bearer token is missing', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'bearer' });
      }).toThrow('Bearer token is required for bearer authentication');
    });

    it('should throw error when bearer token is null', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'bearer', token: null });
      }).toThrow('Bearer token is required for bearer authentication');
    });

    it('should throw error when bearer token is empty string', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'bearer', token: '' });
      }).toThrow('Bearer token is required for bearer authentication');
    });

    it('should throw error when client credentials are missing', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'client-credentials' });
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client ID is missing in credentials', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'client-credentials', clientSecret: 'secret' });
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client secret is missing in credentials', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'client-credentials', clientId: 'id' });
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error for invalid auth type', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'invalid' });
      }).toThrow('Invalid authentication type: invalid. Must be \'bearer\' or \'client-credentials\'');
    });

    it('should throw error for empty auth type', () => {
      // Empty string type is treated as missing type
      expect(() => {
        authHeaders.createAuthHeaders({ type: '' });
      }).toThrow('Authentication configuration is required');
    });

    it('should handle bearer authentication with various token formats', () => {
      const tokens = ['simple-token', 'token-with-dashes', 'token_with_underscores', 'token123'];
      tokens.forEach(token => {
        const headers = authHeaders.createAuthHeaders({ type: 'bearer', token });
        expect(headers['Authorization']).toBe(`Bearer ${token}`);
      });
    });

    it('should handle credentials authentication with various formats', () => {
      const configs = [
        { clientId: 'id1', clientSecret: 'secret1' },
        { clientId: 'id-with-dashes', clientSecret: 'secret-with-dashes' },
        { clientId: 'id123', clientSecret: 'secret456' }
      ];

      configs.forEach(config => {
        const headers = authHeaders.createAuthHeaders({ type: 'client-credentials', ...config });
        expect(headers['x-client-id']).toBe(config.clientId);
        expect(headers['x-client-secret']).toBe(config.clientSecret);
      });
    });
  });
});

