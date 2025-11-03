/**
 * Tests for AI Fabrix Builder Audit Logger Module
 *
 * @fileoverview Unit tests for audit-logger.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const auditLogger = require('../../lib/audit-logger');

describe('Audit Logger Module', () => {
  let originalConsoleLog;

  beforeEach(() => {
    originalConsoleLog = console.log;
    console.log = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
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
    it('should log security events (line 147)', () => {
      auditLogger.logSecurityEvent('authentication_failure', {
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

    it('should handle security events without details', () => {
      auditLogger.logSecurityEvent('access_denied');

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.metadata.event).toBe('access_denied');
    });
  });

  describe('auditLog', () => {
    it('should log audit entries', () => {
      auditLogger.auditLog('INFO', 'Test message', { key: 'value' });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.level).toBe('INFO');
      expect(logData.message).toBe('Test message');
      expect(logData.metadata.key).toBe('value');
    });
  });
});

