/**
 * Tests for AI Fabrix Builder Audit Logger Module
 *
 * @fileoverview Unit tests for audit-logger.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const auditLogger = require('../../lib/audit-logger');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    appendFile: jest.fn()
  }
}));

// Mock paths module
jest.mock('../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(() => '/mock/home/.aifabrix')
}));

describe('Audit Logger Module', () => {
  let originalConsoleLog;
  let originalConsoleError;
  let originalAuditLogConsole;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();
    // Set environment variable to enable console logging for tests
    originalAuditLogConsole = process.env.AUDIT_LOG_CONSOLE;
    process.env.AUDIT_LOG_CONSOLE = 'true';
    // Reset mocks
    fs.mkdir.mockResolvedValue();
    fs.appendFile.mockResolvedValue();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    // Restore original environment variable
    if (originalAuditLogConsole === undefined) {
      delete process.env.AUDIT_LOG_CONSOLE;
    } else {
      process.env.AUDIT_LOG_CONSOLE = originalAuditLogConsole;
    }
    jest.clearAllMocks();
  });

  describe('maskSensitiveData', () => {
    it('should return non-string values unchanged (line 23)', () => {
      expect(auditLogger.maskSensitiveData(null)).toBeNull();
      expect(auditLogger.maskSensitiveData(undefined)).toBeUndefined();
      expect(auditLogger.maskSensitiveData(123)).toBe(123);
      expect(auditLogger.maskSensitiveData({})).toEqual({});
    });

    it('should mask password patterns', () => {
      const input = 'password=secret123';
      const result = auditLogger.maskSensitiveData(input);
      expect(result).toBe('password=***');
    });

    it('should mask secret patterns', () => {
      const input = 'secret: mysecretkey';
      const result = auditLogger.maskSensitiveData(input);
      expect(result).toBe('secret=***');
    });

    it('should mask key patterns', () => {
      const input = 'key=myapikey123';
      const result = auditLogger.maskSensitiveData(input);
      expect(result).toBe('key=***');
    });

    it('should mask token patterns', () => {
      const input = 'token=abc123xyz';
      const result = auditLogger.maskSensitiveData(input);
      expect(result).toBe('token=***');
    });

    it('should mask api_key patterns', () => {
      const input = 'api_key=secretkey123';
      const result = auditLogger.maskSensitiveData(input);
      expect(result).toBe('api_key=***');
    });

    it('should mask long hex strings (line 42)', () => {
      const hexString = 'a1b2c3d4e5f6789012345678901234567890abcdef';
      const result = auditLogger.maskSensitiveData(hexString);
      expect(result).toBe('***');
    });

    it('should not mask short hex strings', () => {
      const shortHex = 'abc123';
      const result = auditLogger.maskSensitiveData(shortHex);
      expect(result).toBe(shortHex);
    });

    it('should mask trimmed hex strings', () => {
      const hexWithSpaces = '  a1b2c3d4e5f6789012345678901234567890abcdef  ';
      const result = auditLogger.maskSensitiveData(hexWithSpaces);
      expect(result).toBe('***');
    });

    it('should handle empty string', () => {
      const result = auditLogger.maskSensitiveData('');
      expect(result).toBe('');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security events (line 147)', async() => {
      await auditLogger.logSecurityEvent('authentication_failure', {
        userId: 'user123',
        ip: '192.168.1.1'
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.level).toBe('AUDIT');
      expect(logData.message).toContain('Security event: authentication_failure');
      expect(logData.metadata.eventType).toBe('security');
      expect(logData.metadata.event).toBe('authentication_failure');
    });

    it('should handle security events without details', async() => {
      await auditLogger.logSecurityEvent('access_denied');

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.event).toBe('access_denied');
    });
  });

  describe('auditLog', () => {
    it('should log audit entries', async() => {
      await auditLogger.auditLog('INFO', 'Test message', { key: 'value' });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.level).toBe('INFO');
      expect(logData.message).toBe('Test message');
      expect(logData.metadata.key).toBe('value');
    });

    it('should log to console.error when file write fails (line 137)', async() => {
      const writeError = new Error('Permission denied');
      fs.appendFile.mockRejectedValue(writeError);

      await auditLogger.auditLog('INFO', 'Test message', { key: 'value' });

      expect(console.error).toHaveBeenCalled();
      const errorCall = console.error.mock.calls[0][0];
      expect(errorCall).toContain('[AUDIT LOG ERROR]');
      expect(errorCall).toContain('Failed to write audit log');
      expect(errorCall).toContain('Permission denied');
    });
  });

  describe('logDeploymentAttempt', () => {
    it('should include api field when provided (line 164)', async() => {
      await auditLogger.logDeploymentAttempt('myapp', 'http://localhost:3000', {
        environment: 'dev',
        api: 'v1'
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.api).toBe('v1');
    });

    it('should not include api field when not provided', async() => {
      await auditLogger.logDeploymentAttempt('myapp', 'http://localhost:3000', {
        environment: 'dev'
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.api).toBeUndefined();
    });

    it('should not include api field when null', async() => {
      await auditLogger.logDeploymentAttempt('myapp', 'http://localhost:3000', {
        environment: 'dev',
        api: null
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.api).toBeUndefined();
    });
  });

  describe('logApplicationCreation', () => {
    it('should include api field when provided (line 246)', async() => {
      await auditLogger.logApplicationCreation('myapp', {
        api: 'v2'
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.api).toBe('v2');
    });

    it('should not include api field when not provided', async() => {
      await auditLogger.logApplicationCreation('myapp', {});

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.api).toBeUndefined();
    });
  });

  describe('logApiCall', () => {
    it('should log successful API calls (line 264-329)', async() => {
      await auditLogger.logApiCall(
        'https://controller.example.com/api/v1/apps',
        { method: 'GET' },
        200,
        150,
        true,
        {}
      );

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.level).toBe('INFO');
      expect(logData.message).toContain('API call succeeded');
      expect(logData.metadata.method).toBe('GET');
      expect(logData.metadata.statusCode).toBe(200);
      expect(logData.metadata.success).toBe(true);
    });

    it('should log failed API calls with error details', async() => {
      await auditLogger.logApiCall(
        'https://controller.example.com/api/v1/apps',
        { method: 'POST' },
        401,
        200,
        false,
        {
          errorType: 'authentication',
          errorMessage: 'Unauthorized',
          correlationId: 'corr-123',
          errorData: { code: 'AUTH_FAILED' }
        }
      );

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.level).toBe('ERROR');
      expect(logData.message).toContain('API call failed');
      expect(logData.metadata.errorType).toBe('authentication');
      expect(logData.metadata.errorMessage).toBe('Unauthorized');
      expect(logData.metadata.correlationId).toBe('corr-123');
    });

    it('should extract controller URL from full URL', async() => {
      await auditLogger.logApiCall(
        'https://controller.example.com:8080/api/v1/apps?filter=active',
        { method: 'GET' },
        200,
        100,
        true,
        {}
      );

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.controllerUrl).toBe('https://controller.example.com:8080');
      expect(logData.metadata.path).toBe('/api/v1/apps?filter=active');
    });

    it('should handle invalid URLs gracefully', async() => {
      await auditLogger.logApiCall(
        'invalid-url',
        { method: 'GET' },
        200,
        100,
        true,
        {}
      );

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.controllerUrl).toBe('invalid-url');
    });

    it('should extract path from URL using regex fallback', async() => {
      // This tests extractPathFromUrl fallback logic (line 328-329)
      await auditLogger.logApiCall(
        'https://example.com/api/v1/test',
        { method: 'GET' },
        200,
        100,
        true,
        {}
      );

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.path).toBe('/api/v1/test');
    });
  });
});

