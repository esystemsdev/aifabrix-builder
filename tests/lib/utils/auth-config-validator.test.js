/**
 * Tests for Auth Config Validator
 *
 * @fileoverview Tests for auth-config-validator.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  validateControllerUrl,
  validateEnvironment,
  checkUserLoggedIn
} = require('../../../lib/utils/auth-config-validator');
const { hasStoredDeviceTokenForController } = require('../../../lib/utils/controller-url');

jest.mock('../../../lib/utils/controller-url');

describe('Auth Config Validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateControllerUrl', () => {
    it('should accept valid HTTPS URL', () => {
      expect(() => validateControllerUrl('https://controller.example.com')).not.toThrow();
    });

    it('should accept valid HTTP URL', () => {
      expect(() => validateControllerUrl('http://controller.example.com')).not.toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateControllerUrl('')).toThrow('Controller URL is required');
    });

    it('should reject null', () => {
      expect(() => validateControllerUrl(null)).toThrow('Controller URL is required');
    });

    it('should reject URL without protocol', () => {
      expect(() => validateControllerUrl('controller.example.com')).toThrow('must start with http:// or https://');
    });

    it('should reject invalid URL format', () => {
      // Use a URL that passes protocol check but fails URL constructor validation
      expect(() => validateControllerUrl('http://[invalid-url')).toThrow('Invalid controller URL format');
    });
  });

  describe('validateEnvironment', () => {
    it('should accept valid environment key', () => {
      expect(() => validateEnvironment('dev')).not.toThrow();
      expect(() => validateEnvironment('tst')).not.toThrow();
      expect(() => validateEnvironment('pro')).not.toThrow();
      expect(() => validateEnvironment('miso')).not.toThrow();
      expect(() => validateEnvironment('my-env')).not.toThrow();
      expect(() => validateEnvironment('env_123')).not.toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateEnvironment('')).toThrow('Environment is required');
    });

    it('should reject null', () => {
      expect(() => validateEnvironment(null)).toThrow('Environment is required');
    });

    it('should reject invalid characters', () => {
      expect(() => validateEnvironment('env@name')).toThrow('must contain only letters, numbers, hyphens, and underscores');
      expect(() => validateEnvironment('env name')).toThrow('must contain only letters, numbers, hyphens, and underscores');
    });
  });

  describe('checkUserLoggedIn', () => {
    it('should return true if user is logged in to controller', async() => {
      hasStoredDeviceTokenForController.mockResolvedValue(true);

      const result = await checkUserLoggedIn('https://controller.example.com');

      expect(result).toBe(true);
      expect(hasStoredDeviceTokenForController).toHaveBeenCalledWith('https://controller.example.com');
    });

    it('should return false if user is not logged in', async() => {
      hasStoredDeviceTokenForController.mockResolvedValue(false);

      const result = await checkUserLoggedIn('https://controller.example.com');

      expect(result).toBe(false);
    });

    it('should return false if controller URLs do not match', async() => {
      hasStoredDeviceTokenForController.mockResolvedValue(false);

      const result = await checkUserLoggedIn('https://controller.example.com');

      expect(result).toBe(false);
    });

    it('should pass controller URL to token lookup', async() => {
      hasStoredDeviceTokenForController.mockResolvedValue(true);

      const result = await checkUserLoggedIn('https://controller.example.com/');

      expect(result).toBe(true);
      expect(hasStoredDeviceTokenForController).toHaveBeenCalledWith('https://controller.example.com/');
    });
  });
});
