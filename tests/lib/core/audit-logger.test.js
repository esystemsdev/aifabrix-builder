/**
 * Tests for AI Fabrix Builder Audit Logger Module
 *
 * @fileoverview Unit tests for audit-logger.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const auditLogger = require('../../../lib/core/audit-logger');
const pathsMod = require('../../../lib/utils/paths');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    appendFile: jest.fn()
  }
}));

// Mock paths module
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(() => '/mock/home/.aifabrix'),
  getAifabrixSystemDir: jest.fn(() => '/mock/home/.aifabrix')
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
    auditLogger.resetAuditLogPathCache();
    pathsMod.getAifabrixSystemDir.mockReturnValue('/mock/home/.aifabrix');
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

  describe('maskSensitiveData (re-export from log-redaction)', () => {
    it('delegates to shared redaction', () => {
      const { maskSensitiveData: direct } = require('../../../lib/utils/log-redaction');
      expect(auditLogger.maskSensitiveData('password=x')).toBe(direct('password=x'));
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

    it('writes audit.log under getAifabrixSystemDir', async() => {
      pathsMod.getAifabrixSystemDir.mockReturnValue('/resolved/config-dir');
      fs.appendFile.mockResolvedValue();
      await auditLogger.auditLog('INFO', 'path probe', {});
      expect(fs.appendFile).toHaveBeenCalledWith(
        path.join('/resolved/config-dir', 'audit.log'),
        expect.any(String),
        'utf8'
      );
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
      await auditLogger.logApiCall({
        url: 'https://controller.example.com/api/v1/apps',
        options: { method: 'GET' },
        statusCode: 200,
        duration: 150,
        success: true,
        errorInfo: {}
      });

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
      await auditLogger.logApiCall({
        url: 'https://controller.example.com/api/v1/apps',
        options: { method: 'POST' },
        statusCode: 401,
        duration: 200,
        success: false,
        errorInfo: {
          errorType: 'authentication',
          errorMessage: 'Unauthorized',
          correlationId: 'corr-123',
          errorData: { code: 'AUTH_FAILED' }
        }
      });

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
      await auditLogger.logApiCall({
        url: 'https://controller.example.com:8080/api/v1/apps?filter=active',
        options: { method: 'GET' },
        statusCode: 200,
        duration: 100,
        success: true,
        errorInfo: {}
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.controllerUrl).toBe('https://controller.example.com:8080');
      expect(logData.metadata.path).toBe('/api/v1/apps?filter=active');
    });

    it('should handle invalid URLs gracefully', async() => {
      await auditLogger.logApiCall({
        url: 'invalid-url',
        options: { method: 'GET' },
        statusCode: 200,
        duration: 100,
        success: true,
        errorInfo: {}
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.controllerUrl).toBe('invalid-url');
    });

    it('should extract path from URL using regex fallback', async() => {
      // This tests extractPathFromUrl fallback logic (line 328-329)
      await auditLogger.logApiCall({
        url: 'https://example.com/api/v1/test',
        options: { method: 'GET' },
        statusCode: 200,
        duration: 100,
        success: true,
        errorInfo: {}
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.path).toBe('/api/v1/test');
    });
  });
});

