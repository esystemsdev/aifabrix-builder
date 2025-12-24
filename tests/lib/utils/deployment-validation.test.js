/**
 * Deployment Validation Utilities Tests
 *
 * Comprehensive unit tests for deployment validation functions
 *
 * @fileoverview Tests for deployment-validation.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const deploymentValidation = require('../../../lib/utils/deployment-validation');

describe('Deployment Validation Utilities', () => {
  describe('validateControllerUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      const validUrls = [
        'https://controller.example.com',
        'https://controller.example.com/',
        'https://controller.example.com:8443',
        'https://subdomain.controller.example.com',
        'https://controller.example.com/path',
        'https://controller.example.com:443/path'
      ];

      validUrls.forEach(url => {
        expect(() => deploymentValidation.validateControllerUrl(url)).not.toThrow();
      });
    });

    it('should accept localhost HTTP URLs', () => {
      const localhostUrls = [
        'http://localhost',
        'http://localhost:3000',
        'http://localhost:8080/path'
      ];

      localhostUrls.forEach(url => {
        expect(() => deploymentValidation.validateControllerUrl(url)).not.toThrow();
      });
    });

    it('should trim trailing slashes', () => {
      const url1 = deploymentValidation.validateControllerUrl('https://controller.example.com/');
      const url2 = deploymentValidation.validateControllerUrl('https://controller.example.com');
      expect(url1).toBe('https://controller.example.com');
      expect(url2).toBe('https://controller.example.com');
    });

    it('should reject HTTP URLs (except localhost)', () => {
      const invalidUrls = [
        'http://controller.example.com',
        'http://controller.example.com/',
        'http://example.com',
        'http://192.168.1.1'
      ];

      invalidUrls.forEach(url => {
        expect(() => deploymentValidation.validateControllerUrl(url)).toThrow('Controller URL must use HTTPS');
      });
    });

    it('should reject invalid URL formats', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://controller.example.com',
        'controller.example.com',
        'https://',
        'https://.com',
        'https://-invalid.com',
        'https://invalid-.com'
      ];

      invalidUrls.forEach(url => {
        expect(() => deploymentValidation.validateControllerUrl(url)).toThrow();
      });
    });

    it('should reject null or undefined URLs', () => {
      expect(() => deploymentValidation.validateControllerUrl(null)).toThrow('Controller URL is required');
      expect(() => deploymentValidation.validateControllerUrl(undefined)).toThrow('Controller URL is required');
    });

    it('should reject empty string URLs', () => {
      expect(() => deploymentValidation.validateControllerUrl('')).toThrow('Controller URL is required');
    });

    it('should reject non-string URLs', () => {
      expect(() => deploymentValidation.validateControllerUrl(123)).toThrow('Controller URL is required');
      expect(() => deploymentValidation.validateControllerUrl({})).toThrow('Controller URL is required');
      expect(() => deploymentValidation.validateControllerUrl([])).toThrow('Controller URL is required');
    });

    it('should accept URLs with IP addresses for localhost', () => {
      expect(() => deploymentValidation.validateControllerUrl('http://localhost:3000')).not.toThrow();
    });

    it('should reject URLs with query parameters (not supported by regex)', () => {
      // The regex pattern doesn't support query parameters
      expect(() => {
        deploymentValidation.validateControllerUrl('https://controller.example.com?param=value');
      }).toThrow('Invalid controller URL format');
    });

    it('should reject URLs with fragments (not supported by regex)', () => {
      // The regex pattern doesn't support fragments
      expect(() => {
        deploymentValidation.validateControllerUrl('https://controller.example.com#section');
      }).toThrow('Invalid controller URL format');
    });
  });

  describe('validateEnvironmentKey', () => {
    it('should accept valid environment keys', () => {
      const validKeys = ['miso', 'dev', 'tst', 'pro'];
      validKeys.forEach(key => {
        expect(() => deploymentValidation.validateEnvironmentKey(key)).not.toThrow();
      });
    });

    it('should normalize environment keys to lowercase', () => {
      expect(deploymentValidation.validateEnvironmentKey('MISO')).toBe('miso');
      expect(deploymentValidation.validateEnvironmentKey('DEV')).toBe('dev');
      expect(deploymentValidation.validateEnvironmentKey('TST')).toBe('tst');
      expect(deploymentValidation.validateEnvironmentKey('PRO')).toBe('pro');
      expect(deploymentValidation.validateEnvironmentKey('MiSo')).toBe('miso');
      expect(deploymentValidation.validateEnvironmentKey('DeV')).toBe('dev');
    });

    it('should reject invalid environment keys', () => {
      const invalidKeys = [
        'prod',
        'production',
        'development',
        'test',
        'staging',
        'qa',
        'invalid',
        'miso-dev',
        'dev1',
        'pro2'
      ];

      invalidKeys.forEach(key => {
        expect(() => deploymentValidation.validateEnvironmentKey(key)).toThrow('Invalid environment key');
      });
    });

    it('should reject null or undefined environment keys', () => {
      expect(() => deploymentValidation.validateEnvironmentKey(null)).toThrow('Environment key is required');
      expect(() => deploymentValidation.validateEnvironmentKey(undefined)).toThrow('Environment key is required');
    });

    it('should reject empty string environment keys', () => {
      expect(() => deploymentValidation.validateEnvironmentKey('')).toThrow('Environment key is required');
    });

    it('should reject non-string environment keys', () => {
      expect(() => deploymentValidation.validateEnvironmentKey(123)).toThrow('Environment key is required');
      expect(() => deploymentValidation.validateEnvironmentKey({})).toThrow('Environment key is required');
      expect(() => deploymentValidation.validateEnvironmentKey([])).toThrow('Environment key is required');
    });

    it('should reject whitespace-only environment keys', () => {
      expect(() => deploymentValidation.validateEnvironmentKey('   ')).toThrow('Invalid environment key');
    });

    it('should provide helpful error message with valid options', () => {
      try {
        deploymentValidation.validateEnvironmentKey('invalid');
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Invalid environment key');
        expect(error.message).toContain('miso');
        expect(error.message).toContain('dev');
        expect(error.message).toContain('tst');
        expect(error.message).toContain('pro');
      }
    });
  });
});

