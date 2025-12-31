/**
 * Tests for lib/utils/app-register-validator.js
 *
 * @fileoverview Unit tests for app registration validation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/logger', () => ({
  error: jest.fn()
}));

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn().mockResolvedValue({
    appPath: '/test/app',
    appType: 'typescript'
  })
}));

// Mock path.relative but keep the real path module for setup.js
const path = require('path');
const originalRelative = path.relative;
path.relative = jest.fn((from, to) => 'builder/testapp');

const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
const logger = require('../../../lib/utils/logger');
const { registerApplicationSchema, validateAppRegistrationData } = require('../../../lib/utils/app-register-validator');

describe('app-register-validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    processExitSpy.mockRestore();
  });

  describe('registerApplicationSchema.environmentId', () => {
    it('should throw error for empty string', () => {
      expect(() => {
        registerApplicationSchema.environmentId('');
      }).toThrow('Invalid environment ID format');
    });

    it('should throw error for null', () => {
      expect(() => {
        registerApplicationSchema.environmentId(null);
      }).toThrow('Invalid environment ID format');
    });

    it('should return valid environment ID', () => {
      const result = registerApplicationSchema.environmentId('dev');
      expect(result).toBe('dev');
    });
  });

  describe('registerApplicationSchema.key', () => {
    it('should throw error for empty string', () => {
      expect(() => {
        registerApplicationSchema.key('');
      }).toThrow('Application key is required');
    });

    it('should throw error for null', () => {
      expect(() => {
        registerApplicationSchema.key(null);
      }).toThrow('Application key is required');
    });

    it('should throw error for key exceeding max length', () => {
      const longKey = 'a'.repeat(41);
      expect(() => {
        registerApplicationSchema.key(longKey);
      }).toThrow('Application key must be at most 40 characters');
    });

    it('should throw error for invalid pattern', () => {
      expect(() => {
        registerApplicationSchema.key('Invalid Key!');
      }).toThrow('Application key must contain only lowercase letters, numbers, and hyphens');
    });

    it('should return valid key', () => {
      const result = registerApplicationSchema.key('valid-key-123');
      expect(result).toBe('valid-key-123');
    });
  });

  describe('registerApplicationSchema.displayName', () => {
    it('should throw error for empty string', () => {
      expect(() => {
        registerApplicationSchema.displayName('');
      }).toThrow('Display name is required');
    });

    it('should throw error for null', () => {
      expect(() => {
        registerApplicationSchema.displayName(null);
      }).toThrow('Display name is required');
    });

    it('should throw error for display name exceeding max length', () => {
      const longName = 'a'.repeat(101);
      expect(() => {
        registerApplicationSchema.displayName(longName);
      }).toThrow('Display name must be at most 100 characters');
    });

    it('should return valid display name', () => {
      const result = registerApplicationSchema.displayName('Valid Display Name');
      expect(result).toBe('Valid Display Name');
    });
  });

  describe('registerApplicationSchema.description', () => {
    it('should return undefined for null', () => {
      const result = registerApplicationSchema.description(null);
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const result = registerApplicationSchema.description('');
      expect(result).toBeUndefined();
    });

    it('should return description value', () => {
      const result = registerApplicationSchema.description('Test description');
      expect(result).toBe('Test description');
    });
  });

  describe('registerApplicationSchema.image', () => {
    it('should throw error for non-external type without image', () => {
      expect(() => {
        registerApplicationSchema.image(null, 'typescript');
      }).toThrow('Image is required for non-external application types');
    });

    it('should throw error for non-external type with empty string', () => {
      expect(() => {
        registerApplicationSchema.image('', 'typescript');
      }).toThrow('Image is required for non-external application types');
    });

    it('should throw error for invalid image format', () => {
      expect(() => {
        registerApplicationSchema.image('invalid-image', 'typescript');
      }).toThrow('Image must be in format repository:tag');
    });

    it('should return valid image for non-external type', () => {
      const result = registerApplicationSchema.image('myregistry.azurecr.io/app:latest', 'typescript');
      expect(result).toBe('myregistry.azurecr.io/app:latest');
    });

    it('should return undefined for external type without image', () => {
      const result = registerApplicationSchema.image(null, 'external');
      expect(result).toBeUndefined();
    });

    it('should return image for external type', () => {
      const result = registerApplicationSchema.image('myregistry.azurecr.io/app:latest', 'external');
      expect(result).toBe('myregistry.azurecr.io/app:latest');
    });
  });

  describe('registerApplicationSchema.configuration', () => {
    it('should throw error for missing type', () => {
      expect(() => {
        registerApplicationSchema.configuration({});
      }).toThrow('Configuration type must be one of:');
    });

    it('should throw error for invalid type', () => {
      expect(() => {
        registerApplicationSchema.configuration({ type: 'invalid' });
      }).toThrow('Configuration type must be one of:');
    });

    it('should throw error for external type without externalIntegration', () => {
      expect(() => {
        registerApplicationSchema.configuration({ type: 'external' });
      }).toThrow('externalIntegration is required for external application type');
    });

    it('should return configuration for external type with externalIntegration', () => {
      const config = {
        type: 'external',
        externalIntegration: { key: 'test' }
      };
      const result = registerApplicationSchema.configuration(config);
      expect(result).toEqual(config);
    });

    it('should throw error for non-external type without registryMode', () => {
      expect(() => {
        registerApplicationSchema.configuration({ type: 'webapp' });
      }).toThrow('Registry mode must be one of:');
    });

    it('should throw error for non-external type with invalid registryMode', () => {
      expect(() => {
        registerApplicationSchema.configuration({
          type: 'webapp',
          registryMode: 'invalid'
        });
      }).toThrow('Registry mode must be one of:');
    });

    it('should throw error for non-external type without port', () => {
      expect(() => {
        registerApplicationSchema.configuration({
          type: 'webapp',
          registryMode: 'acr'
        });
      }).toThrow('Port is required for non-external application types');
    });

    it('should throw error for non-external type with null port', () => {
      expect(() => {
        registerApplicationSchema.configuration({
          type: 'webapp',
          registryMode: 'acr',
          port: null
        });
      }).toThrow('Port is required for non-external application types');
    });

    it('should throw error for non-integer port', () => {
      expect(() => {
        registerApplicationSchema.configuration({
          type: 'webapp',
          registryMode: 'acr',
          port: 3000.5
        });
      }).toThrow('Port must be an integer between');
    });

    it('should throw error for port below minimum', () => {
      expect(() => {
        registerApplicationSchema.configuration({
          type: 'webapp',
          registryMode: 'acr',
          port: 0
        });
      }).toThrow('Port must be an integer between');
    });

    it('should throw error for port above maximum', () => {
      expect(() => {
        registerApplicationSchema.configuration({
          type: 'webapp',
          registryMode: 'acr',
          port: 65536
        });
      }).toThrow('Port must be an integer between');
    });

    it('should return valid configuration for non-external type', () => {
      const config = {
        type: 'webapp',
        registryMode: 'acr',
        port: 3000
      };
      const result = registerApplicationSchema.configuration(config);
      expect(result).toEqual(config);
    });
  });

  describe('validateAppRegistrationData', () => {
    it('should exit when appKey is missing', async() => {
      const config = {
        displayName: 'Test App'
      };
      await validateAppRegistrationData(config, 'testapp');
      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit when displayName is missing', async() => {
      const config = {
        appKey: 'testapp'
      };
      await validateAppRegistrationData(config, 'testapp');
      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit when both appKey and displayName are missing', async() => {
      const config = {};
      await validateAppRegistrationData(config, 'testapp');
      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should show correct path in error message', async() => {
      const config = {};
      await validateAppRegistrationData(config, 'testapp');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('builder/testapp'));
    });

    it('should exit on invalid appKey', async() => {
      const config = {
        appKey: 'Invalid Key!',
        displayName: 'Test App',
        appType: 'typescript',
        registryMode: 'acr',
        port: 3000,
        image: 'registry/app:latest'
      };
      await validateAppRegistrationData(config, 'testapp');
      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit on invalid displayName', async() => {
      const config = {
        appKey: 'testapp',
        displayName: '',
        appType: 'typescript',
        registryMode: 'acr',
        port: 3000,
        image: 'registry/app:latest'
      };
      await validateAppRegistrationData(config, 'testapp');
      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit on invalid image for non-external type', async() => {
      const config = {
        appKey: 'testapp',
        displayName: 'Test App',
        appType: 'typescript',
        registryMode: 'acr',
        port: 3000,
        image: 'invalid-image'
      };
      await validateAppRegistrationData(config, 'testapp');
      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit on invalid configuration', async() => {
      const config = {
        appKey: 'testapp',
        displayName: 'Test App',
        appType: 'webapp',
        registryMode: 'invalid',
        port: 3000,
        image: 'registry/app:latest'
      };
      await validateAppRegistrationData(config, 'testapp');
      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should not exit for valid configuration', async() => {
      const config = {
        appKey: 'testapp',
        displayName: 'Test App',
        appType: 'webapp',
        registryMode: 'acr',
        port: 3000,
        image: 'registry/app:latest'
      };
      await validateAppRegistrationData(config, 'testapp');
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should validate external type configuration', async() => {
      const config = {
        appKey: 'testapp',
        displayName: 'Test App',
        appType: 'external',
        externalIntegration: { key: 'test' }
      };
      await validateAppRegistrationData(config, 'testapp');
      expect(process.exit).not.toHaveBeenCalled();
    });
  });
});

