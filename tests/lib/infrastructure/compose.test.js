/**
 * Tests for AI Fabrix Builder Infrastructure Compose Module
 *
 * @fileoverview Unit tests for compose.js module (Traefik infrastructure support)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock fs before requiring compose module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn()
  };
});

// Mock handlebars
jest.mock('handlebars', () => ({
  compile: jest.fn()
}));

const compose = require('../../../lib/infrastructure/compose');
const handlebars = require('handlebars');

describe('Infrastructure Compose Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.TRAEFIK_CERT_STORE;
    delete process.env.TRAEFIK_CERT_FILE;
    delete process.env.TRAEFIK_KEY_FILE;
    fs.existsSync.mockReturnValue(false);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('buildTraefikConfig', () => {
    it('should return disabled config when enabled is false', () => {
      const config = compose.buildTraefikConfig(false);

      expect(config).toEqual({
        enabled: false,
        certStore: null,
        certFile: null,
        keyFile: null
      });
    });

    it('should return disabled config when enabled is falsy', () => {
      const config1 = compose.buildTraefikConfig(0);
      const config2 = compose.buildTraefikConfig(null);
      const config3 = compose.buildTraefikConfig(undefined);

      expect(config1.enabled).toBe(false);
      expect(config2.enabled).toBe(false);
      expect(config3.enabled).toBe(false);
    });

    it('should return enabled config when enabled is true', () => {
      const config = compose.buildTraefikConfig(true);

      expect(config).toEqual({
        enabled: true,
        certStore: null,
        certFile: null,
        keyFile: null
      });
    });

    it('should read certificate store from environment variable', () => {
      process.env.TRAEFIK_CERT_STORE = 'wildcard';

      const config = compose.buildTraefikConfig(true);

      expect(config.certStore).toBe('wildcard');
      expect(config.enabled).toBe(true);
    });

    it('should read certificate file from environment variable', () => {
      process.env.TRAEFIK_CERT_FILE = '/path/to/cert.crt';

      const config = compose.buildTraefikConfig(true);

      expect(config.certFile).toBe('/path/to/cert.crt');
      expect(config.enabled).toBe(true);
    });

    it('should read key file from environment variable', () => {
      process.env.TRAEFIK_KEY_FILE = '/path/to/key.key';

      const config = compose.buildTraefikConfig(true);

      expect(config.keyFile).toBe('/path/to/key.key');
      expect(config.enabled).toBe(true);
    });

    it('should read all certificate configuration from environment variables', () => {
      process.env.TRAEFIK_CERT_STORE = 'wildcard';
      process.env.TRAEFIK_CERT_FILE = '/path/to/wildcard.crt';
      process.env.TRAEFIK_KEY_FILE = '/path/to/wildcard.key';

      const config = compose.buildTraefikConfig(true);

      expect(config).toEqual({
        enabled: true,
        certStore: 'wildcard',
        certFile: '/path/to/wildcard.crt',
        keyFile: '/path/to/wildcard.key'
      });
    });

    it('should return null for missing environment variables', () => {
      const config = compose.buildTraefikConfig(true);

      expect(config.certStore).toBeNull();
      expect(config.certFile).toBeNull();
      expect(config.keyFile).toBeNull();
    });
  });

  describe('validateTraefikConfig', () => {
    it('should return valid when config is null', () => {
      const result = compose.validateTraefikConfig(null);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return valid when config is undefined', () => {
      const result = compose.validateTraefikConfig(undefined);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return valid when enabled is false', () => {
      const config = { enabled: false };
      const result = compose.validateTraefikConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return valid when enabled is true but no certStore', () => {
      const config = { enabled: true };
      const result = compose.validateTraefikConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return invalid when certStore provided but certFile missing', () => {
      const config = {
        enabled: true,
        certStore: 'wildcard',
        keyFile: '/path/to/key.key'
      };
      const result = compose.validateTraefikConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TRAEFIK_CERT_FILE and TRAEFIK_KEY_FILE are required when TRAEFIK_CERT_STORE is set');
    });

    it('should return invalid when certStore provided but keyFile missing', () => {
      const config = {
        enabled: true,
        certStore: 'wildcard',
        certFile: '/path/to/cert.crt'
      };
      const result = compose.validateTraefikConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TRAEFIK_CERT_FILE and TRAEFIK_KEY_FILE are required when TRAEFIK_CERT_STORE is set');
    });

    it('should return invalid when certStore provided but both certFile and keyFile missing', () => {
      const config = {
        enabled: true,
        certStore: 'wildcard'
      };
      const result = compose.validateTraefikConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TRAEFIK_CERT_FILE and TRAEFIK_KEY_FILE are required when TRAEFIK_CERT_STORE is set');
    });

    it('should return invalid when certFile does not exist', () => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === '/path/to/key.key';
      });

      const config = {
        enabled: true,
        certStore: 'wildcard',
        certFile: '/path/to/cert.crt',
        keyFile: '/path/to/key.key'
      };
      const result = compose.validateTraefikConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Certificate file not found: /path/to/cert.crt');
      expect(result.errors).not.toContain('Private key file not found');
    });

    it('should return invalid when keyFile does not exist', () => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === '/path/to/cert.crt';
      });

      const config = {
        enabled: true,
        certStore: 'wildcard',
        certFile: '/path/to/cert.crt',
        keyFile: '/path/to/key.key'
      };
      const result = compose.validateTraefikConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Private key file not found: /path/to/key.key');
      expect(result.errors).not.toContain('Certificate file not found');
    });

    it('should return invalid when both certFile and keyFile do not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const config = {
        enabled: true,
        certStore: 'wildcard',
        certFile: '/path/to/cert.crt',
        keyFile: '/path/to/key.key'
      };
      const result = compose.validateTraefikConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Certificate file not found: /path/to/cert.crt');
      expect(result.errors).toContain('Private key file not found: /path/to/key.key');
    });

    it('should return valid when certStore and both files exist', () => {
      fs.existsSync.mockReturnValue(true);

      const config = {
        enabled: true,
        certStore: 'wildcard',
        certFile: '/path/to/cert.crt',
        keyFile: '/path/to/key.key'
      };
      const result = compose.validateTraefikConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should check file existence for both certFile and keyFile', () => {
      fs.existsSync.mockReturnValue(true);

      const config = {
        enabled: true,
        certStore: 'wildcard',
        certFile: '/path/to/cert.crt',
        keyFile: '/path/to/key.key'
      };
      compose.validateTraefikConfig(config);

      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/cert.crt');
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/key.key');
    });
  });

  describe('generateComposeFile', () => {
    const mockTemplatePath = '/path/to/template.hbs';
    const mockInfraDir = '/tmp/infra';
    const mockTemplateContent = 'services:\n  postgres:\n    image: postgres\n{{#if traefik.enabled}}  traefik:\n    image: traefik\n{{/if}}';
    const mockCompiledTemplate = jest.fn();
    const mockPorts = {
      postgres: 5432,
      redis: 6379,
      pgadmin: 5050,
      redisCommander: 8081,
      traefikHttp: 80,
      traefikHttps: 443
    };

    beforeEach(() => {
      fs.readFileSync.mockReturnValue(mockTemplateContent);
      handlebars.compile.mockReturnValue(mockCompiledTemplate);
      mockCompiledTemplate.mockReturnValue('rendered compose content');
      fs.writeFileSync.mockImplementation(() => {});
    });

    it('should read template file', () => {
      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir);

      expect(fs.readFileSync).toHaveBeenCalledWith(mockTemplatePath, 'utf8');
    });

    it('should compile template with Handlebars', () => {
      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir);

      expect(handlebars.compile).toHaveBeenCalledWith(mockTemplateContent);
    });

    it('should write compose file to infra directory', () => {
      const composePath = compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir);

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(composePath).toBe(path.join(mockInfraDir, 'compose.yaml'));
    });

    it('should pass correct network name for dev 0', () => {
      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          networkName: 'infra-aifabrix-network'
        })
      );
    });

    it('should pass correct network name for dev > 0', () => {
      compose.generateComposeFile(mockTemplatePath, '1', 1, mockPorts, mockInfraDir);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          networkName: 'infra-dev1-aifabrix-network'
        })
      );
    });

    it('should pass all port configurations', () => {
      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          postgresPort: 5432,
          redisPort: 6379,
          pgadminPort: 5050,
          redisCommanderPort: 8081,
          traefikHttpPort: 80,
          traefikHttpsPort: 443
        })
      );
    });

    it('should pass devId to template', () => {
      compose.generateComposeFile(mockTemplatePath, '1', 1, mockPorts, mockInfraDir);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          devId: '1'
        })
      );
    });

    it('should pass infraDir to template', () => {
      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          infraDir: mockInfraDir
        })
      );
    });

    it('should build Traefik config when traefik option is boolean true', () => {
      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir, { traefik: true });

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          traefik: expect.objectContaining({
            enabled: true
          })
        })
      );
    });

    it('should build Traefik config when traefik option is boolean false', () => {
      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir, { traefik: false });

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          traefik: expect.objectContaining({
            enabled: false
          })
        })
      );
    });

    it('should use provided Traefik config object when traefik option is object', () => {
      const traefikConfig = {
        enabled: true,
        certStore: 'wildcard',
        certFile: '/path/to/cert.crt',
        keyFile: '/path/to/key.key'
      };

      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir, { traefik: traefikConfig });

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          traefik: traefikConfig
        })
      );
    });

    it('should build disabled Traefik config when traefik option not provided', () => {
      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          traefik: expect.objectContaining({
            enabled: false
          })
        })
      );
    });

    it('should read environment variables when building Traefik config', () => {
      process.env.TRAEFIK_CERT_STORE = 'wildcard';
      process.env.TRAEFIK_CERT_FILE = '/path/to/cert.crt';
      process.env.TRAEFIK_KEY_FILE = '/path/to/key.key';

      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir, { traefik: true });

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          traefik: expect.objectContaining({
            enabled: true,
            certStore: 'wildcard',
            certFile: '/path/to/cert.crt',
            keyFile: '/path/to/key.key'
          })
        })
      );
    });

    it('should pass servers.json and pgpass paths', () => {
      compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          serversJsonPath: path.join(mockInfraDir, 'servers.json'),
          pgpassPath: path.join(mockInfraDir, 'pgpass')
        })
      );
    });

    it('should return path to generated compose file', () => {
      const result = compose.generateComposeFile(mockTemplatePath, '0', 0, mockPorts, mockInfraDir);

      expect(result).toBe(path.join(mockInfraDir, 'compose.yaml'));
    });
  });
});
