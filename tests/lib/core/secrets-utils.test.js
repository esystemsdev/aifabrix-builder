/**
 * Tests for Secrets Utils Module
 *
 * @fileoverview Unit tests for secrets-utils.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock logger before requiring modules that use it
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock js-yaml module
jest.mock('js-yaml', () => {
  const actualYaml = jest.requireActual('js-yaml');
  return {
    load: jest.fn((content) => {
      // Default implementation that actually parses YAML
      return actualYaml.load(content);
    })
  };
});

// Mock fs and os modules
jest.mock('fs');
jest.mock('os');
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn()
}));

const yaml = require('js-yaml');

const secretsUtils = require('../../../lib/utils/secrets-utils');
const logger = require('../../../lib/utils/logger');
const pathsUtil = require('../../../lib/utils/paths');

describe('Secrets Utils Module', () => {
  const mockHomeDir = '/home/test';
  const mockUserSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
  const mockDefaultSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    // Default paths.getAifabrixHome() to return mockHomeDir/.aifabrix
    pathsUtil.getAifabrixHome.mockReturnValue(path.join(mockHomeDir, '.aifabrix'));
    // Reset yaml.load to use actual implementation by default
    const actualYaml = jest.requireActual('js-yaml');
    yaml.load.mockImplementation((content) => actualYaml.load(content));
  });

  describe('loadSecretsFromFile', () => {
    it('should return empty object when file does not exist', async() => {
      fs.existsSync.mockReturnValue(false);

      const result = await secretsUtils.loadSecretsFromFile('/nonexistent/file.yaml');

      expect(result).toEqual({});
      expect(fs.existsSync).toHaveBeenCalledWith('/nonexistent/file.yaml');
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should load secrets from existing file', async() => {
      const mockSecrets = { 'postgres-passwordKeyVault': 'admin123' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: "admin123"');

      const result = await secretsUtils.loadSecretsFromFile('/path/to/secrets.yaml');

      expect(result).toEqual(mockSecrets);
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/secrets.yaml');
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/secrets.yaml', 'utf8');
    });

    it('should return empty object when secrets is null', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('null');

      const result = await secretsUtils.loadSecretsFromFile('/path/to/secrets.yaml');

      expect(result).toEqual({});
    });

    it('should return empty object when secrets is not an object', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('"just a string"');

      const result = await secretsUtils.loadSecretsFromFile('/path/to/secrets.yaml');

      expect(result).toEqual({});
    });

    it('should return empty object and log warning on YAML parse error', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [');
      yaml.load.mockImplementation(() => {
        throw new Error('YAML parse error');
      });

      const result = await secretsUtils.loadSecretsFromFile('/path/to/secrets.yaml');

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not read secrets file')
      );
    });

    it('should return empty object and log warning on file read error', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await secretsUtils.loadSecretsFromFile('/path/to/secrets.yaml');

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not read secrets file')
      );
    });
  });

  describe('loadUserSecrets', () => {
    it('should return empty object when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = secretsUtils.loadUserSecrets();

      expect(result).toEqual({});
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalledWith(mockUserSecretsPath);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should respect config.yaml aifabrix-home override', () => {
      const overrideHome = '/custom/aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('test-key: "test-value"');
      yaml.load.mockReturnValue({ 'test-key': 'test-value' });

      const result = secretsUtils.loadUserSecrets();

      expect(result).toEqual({ 'test-key': 'test-value' });
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalledWith(overrideSecretsPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(overrideSecretsPath, 'utf8');
    });

    it('should fall back to default when override not set', () => {
      pathsUtil.getAifabrixHome.mockReturnValue(path.join(mockHomeDir, '.aifabrix'));
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('test-key: "test-value"');
      yaml.load.mockReturnValue({ 'test-key': 'test-value' });

      const result = secretsUtils.loadUserSecrets();

      expect(result).toEqual({ 'test-key': 'test-value' });
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalledWith(mockUserSecretsPath);
    });

    it('should load secrets from user secrets file', () => {
      const mockSecrets = { 'myapp-client-idKeyVault': 'client-id-value' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('myapp-client-idKeyVault: "client-id-value"');
      yaml.load.mockReturnValue(mockSecrets);

      const result = secretsUtils.loadUserSecrets();

      expect(result).toEqual(mockSecrets);
      expect(fs.existsSync).toHaveBeenCalledWith(mockUserSecretsPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockUserSecretsPath, 'utf8');
    });

    it('should throw error when secrets is not an object', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('"just a string"');
      yaml.load.mockReturnValue('just a string');

      expect(() => secretsUtils.loadUserSecrets()).toThrow('Invalid secrets file format');
    });

    it('should throw error when secrets is null', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('null');
      yaml.load.mockReturnValue(null);

      expect(() => secretsUtils.loadUserSecrets()).toThrow('Invalid secrets file format');
    });

    it('should return empty object and log warning on YAML parse error', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [');
      yaml.load.mockImplementation(() => {
        throw new Error('YAML parse error');
      });

      const result = secretsUtils.loadUserSecrets();

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not read secrets file')
      );
    });

    it('should return empty object and log warning on file read error', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = secretsUtils.loadUserSecrets();

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not read secrets file')
      );
    });
  });

  // loadBuildSecrets removed - functionality moved to config.yaml aifabrix-secrets
  // Tests removed as function no longer exists
  describe.skip('loadBuildSecrets (removed)', () => {
    const appName = 'testapp';
    const variablesPath = path.join(process.cwd(), 'builder', appName, 'application.yaml');

    it('should return merged secrets when application.yaml does not exist', async() => {
      const mergedSecrets = { 'existing-key': 'existing-value' };
      fs.existsSync.mockReturnValue(false);

      const result = await secretsUtils.loadBuildSecrets(mergedSecrets, appName);

      expect(result).toEqual(mergedSecrets);
      expect(fs.existsSync).toHaveBeenCalledWith(variablesPath);
    });

    it('should return merged secrets when application.yaml exists but no build.secrets', async() => {
      const mergedSecrets = { 'existing-key': 'existing-value' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('port: 3000');

      const result = await secretsUtils.loadBuildSecrets(mergedSecrets, appName);

      expect(result).toEqual(mergedSecrets);
    });

    it('should merge build secrets when build.secrets is configured', async() => {
      const mergedSecrets = { 'existing-key': 'existing-value' };
      const buildSecretsPath = path.resolve(
        path.dirname(variablesPath),
        '../../secrets.local.yaml'
      );
      const buildSecrets = { 'build-key': 'build-value' };

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === variablesPath || filePath === buildSecretsPath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return 'build:\n  secrets: ../../secrets.local.yaml';
        }
        if (filePath === buildSecretsPath) {
          return 'build-key: "build-value"';
        }
        return '';
      });
      yaml.load.mockImplementation((content) => {
        if (content.includes('build:')) {
          return { build: { secrets: '../../secrets.local.yaml' } };
        }
        if (content.includes('build-key')) {
          return buildSecrets;
        }
        return {};
      });

      const result = await secretsUtils.loadBuildSecrets(mergedSecrets, appName);

      expect(result['existing-key']).toBe('existing-value');
      expect(result['build-key']).toBe('build-value');
    });

    it('should not override existing non-empty values with build secrets', async() => {
      const mergedSecrets = { 'shared-key': 'user-value' };
      const buildSecretsPath = path.resolve(
        path.dirname(variablesPath),
        '../../secrets.local.yaml'
      );
      const buildSecrets = { 'shared-key': 'build-value' };

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === variablesPath || filePath === buildSecretsPath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return 'build:\n  secrets: ../../secrets.local.yaml';
        }
        if (filePath === buildSecretsPath) {
          return 'shared-key: "build-value"';
        }
        return '';
      });

      const result = await secretsUtils.loadBuildSecrets(mergedSecrets, appName);

      expect(result['shared-key']).toBe('user-value');
    });

    it('should use build secrets for empty values in merged secrets', async() => {
      const mergedSecrets = { 'shared-key': '' };
      const buildSecretsPath = path.resolve(
        path.dirname(variablesPath),
        '../../secrets.local.yaml'
      );
      const buildSecrets = { 'shared-key': 'build-value' };

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === variablesPath || filePath === buildSecretsPath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return 'build:\n  secrets: ../../secrets.local.yaml';
        }
        if (filePath === buildSecretsPath) {
          return 'shared-key: "build-value"';
        }
        return '';
      });
      yaml.load.mockImplementation((content) => {
        if (content.includes('build:')) {
          return { build: { secrets: '../../secrets.local.yaml' } };
        }
        if (content.includes('shared-key')) {
          return buildSecrets;
        }
        return {};
      });

      const result = await secretsUtils.loadBuildSecrets(mergedSecrets, appName);

      expect(result['shared-key']).toBe('build-value');
    });

    it('should use build secrets for missing keys in merged secrets', async() => {
      const mergedSecrets = { 'existing-key': 'existing-value' };
      const buildSecretsPath = path.resolve(
        path.dirname(variablesPath),
        '../../secrets.local.yaml'
      );
      const buildSecrets = { 'new-key': 'new-value' };

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === variablesPath || filePath === buildSecretsPath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return 'build:\n  secrets: ../../secrets.local.yaml';
        }
        if (filePath === buildSecretsPath) {
          return 'new-key: "new-value"';
        }
        return '';
      });
      yaml.load.mockImplementation((content) => {
        if (content.includes('build:')) {
          return { build: { secrets: '../../secrets.local.yaml' } };
        }
        if (content.includes('new-key')) {
          return buildSecrets;
        }
        return {};
      });

      const result = await secretsUtils.loadBuildSecrets(mergedSecrets, appName);

      expect(result['existing-key']).toBe('existing-value');
      expect(result['new-key']).toBe('new-value');
    });

    it('should return merged secrets and log warning on error loading application.yaml', async() => {
      const mergedSecrets = { 'existing-key': 'existing-value' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await secretsUtils.loadBuildSecrets(mergedSecrets, appName);

      expect(result).toEqual(mergedSecrets);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not load build.secrets from application.yaml')
      );
    });

    it('should return merged secrets and log warning on YAML parse error', async() => {
      const mergedSecrets = { 'existing-key': 'existing-value' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [');
      yaml.load.mockImplementation(() => {
        throw new Error('YAML parse error');
      });

      const result = await secretsUtils.loadBuildSecrets(mergedSecrets, appName);

      expect(result).toEqual(mergedSecrets);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not load build.secrets from application.yaml')
      );
    });
  });

  describe('loadDefaultSecrets', () => {
    it('should return empty object when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = secretsUtils.loadDefaultSecrets();

      expect(result).toEqual({});
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalledWith(mockDefaultSecretsPath);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should respect config.yaml aifabrix-home override', () => {
      const overrideHome = '/custom/aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.yaml');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('test-key: "test-value"');
      yaml.load.mockReturnValue({ 'test-key': 'test-value' });

      const result = secretsUtils.loadDefaultSecrets();

      expect(result).toEqual({ 'test-key': 'test-value' });
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalledWith(overrideSecretsPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(overrideSecretsPath, 'utf8');
    });

    it('should load secrets from default secrets file', () => {
      const mockSecrets = { 'postgres-passwordKeyVault': 'admin123' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: "admin123"');
      yaml.load.mockReturnValue(mockSecrets);

      const result = secretsUtils.loadDefaultSecrets();

      expect(result).toEqual(mockSecrets);
      expect(fs.existsSync).toHaveBeenCalledWith(mockDefaultSecretsPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockDefaultSecretsPath, 'utf8');
    });

    it('should throw error when secrets is not an object', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('"just a string"');
      yaml.load.mockReturnValue('just a string');

      expect(() => secretsUtils.loadDefaultSecrets()).toThrow('Invalid secrets file format');
    });

    it('should throw error when secrets is null', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('null');
      yaml.load.mockReturnValue(null);

      expect(() => secretsUtils.loadDefaultSecrets()).toThrow('Invalid secrets file format');
    });

    it('should return empty object and log warning on YAML parse error', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [');
      yaml.load.mockImplementation(() => {
        throw new Error('YAML parse error');
      });

      const result = secretsUtils.loadDefaultSecrets();

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not read secrets file')
      );
    });

    it('should return empty object and log warning on file read error', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = secretsUtils.loadDefaultSecrets();

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not read secrets file')
      );
    });
  });

  describe('buildHostnameToServiceMap', () => {
    it('should build map from docker hosts with _HOST suffix', () => {
      const dockerHosts = {
        KEYCLOAK_HOST: 'keycloak',
        MISO_HOST: 'miso-controller',
        DB_HOST: 'postgres',
        OTHER_VAR: 'value'
      };

      const result = secretsUtils.buildHostnameToServiceMap(dockerHosts);

      expect(result).toEqual({
        keycloak: 'keycloak',
        'miso-controller': 'miso-controller',
        postgres: 'postgres'
      });
      expect(result['value']).toBeUndefined();
    });

    it('should return empty object when no _HOST keys exist', () => {
      const dockerHosts = {
        DB_NAME: 'mydb',
        PORT: '3000'
      };

      const result = secretsUtils.buildHostnameToServiceMap(dockerHosts);

      expect(result).toEqual({});
    });

    it('should return empty object for empty input', () => {
      const result = secretsUtils.buildHostnameToServiceMap({});

      expect(result).toEqual({});
    });

    it('should handle multiple _HOST keys with same hostname', () => {
      const dockerHosts = {
        KEYCLOAK_HOST: 'keycloak',
        KEYCLOAK_AUTH_HOST: 'keycloak'
      };

      const result = secretsUtils.buildHostnameToServiceMap(dockerHosts);

      expect(result).toEqual({
        keycloak: 'keycloak'
      });
    });
  });

  describe('resolveUrlPort', () => {
    const protocol = 'http://';
    const hostname = 'keycloak';
    const port = '8082';
    const urlPath = '/auth/realms/master';
    const hostnameToService = { keycloak: 'keycloak' };

    it('should return original URL when hostname is not in service map', () => {
      const emptyMap = {};
      const result = secretsUtils.resolveUrlPort(protocol, hostname, port, urlPath, emptyMap);

      expect(result).toBe(`${protocol}${hostname}:${port}${urlPath}`);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('should return original URL when service application.yaml does not exist', () => {
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'application.yaml');
      fs.existsSync.mockReturnValue(false);

      const result = secretsUtils.resolveUrlPort(protocol, hostname, port, urlPath, hostnameToService);

      expect(result).toBe(`${protocol}${hostname}:${port}${urlPath}`);
      expect(fs.existsSync).toHaveBeenCalledWith(serviceVariablesPath);
    });

    it('should replace port with containerPort from application.yaml', () => {
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'application.yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
port: 8082
build:
  containerPort: 8080
`);
      yaml.load.mockReturnValue({
        port: 8082,
        build: { containerPort: 8080 }
      });

      const result = secretsUtils.resolveUrlPort(protocol, hostname, port, urlPath, hostnameToService);

      expect(result).toBe(`${protocol}${hostname}:8080${urlPath}`);
      expect(fs.existsSync).toHaveBeenCalledWith(serviceVariablesPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(serviceVariablesPath, 'utf8');
    });

    it('should fallback to port when containerPort is not defined', () => {
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'application.yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('port: 8080');
      yaml.load.mockReturnValue({ port: 8080 });

      const result = secretsUtils.resolveUrlPort(protocol, hostname, port, urlPath, hostnameToService);

      expect(result).toBe(`${protocol}${hostname}:8080${urlPath}`);
    });

    it('should use original port when neither containerPort nor port is defined', () => {
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'application.yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('build: {}');

      const result = secretsUtils.resolveUrlPort(protocol, hostname, port, urlPath, hostnameToService);

      expect(result).toBe(`${protocol}${hostname}:${port}${urlPath}`);
    });

    it('should preserve URL path and query parameters', () => {
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'application.yaml');
      const fullPath = '/auth/realms/master?param=value';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
port: 8082
build:
  containerPort: 8080
`);
      yaml.load.mockReturnValue({
        port: 8082,
        build: { containerPort: 8080 }
      });

      const result = secretsUtils.resolveUrlPort(protocol, hostname, port, fullPath, hostnameToService);

      expect(result).toBe(`${protocol}${hostname}:8080${fullPath}`);
    });

    it('should return original URL and log warning on YAML parse error', () => {
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'application.yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [');
      yaml.load.mockImplementation(() => {
        throw new Error('YAML parse error');
      });

      const result = secretsUtils.resolveUrlPort(protocol, hostname, port, urlPath, hostnameToService);

      expect(result).toBe(`${protocol}${hostname}:${port}${urlPath}`);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not load application config for service keycloak')
      );
    });

    it('should return original URL and log warning on file read error', () => {
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'application.yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = secretsUtils.resolveUrlPort(protocol, hostname, port, urlPath, hostnameToService);

      expect(result).toBe(`${protocol}${hostname}:${port}${urlPath}`);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not load application config for service keycloak')
      );
    });

    it('should handle https protocol', () => {
      const httpsProtocol = 'https://';
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'application.yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
port: 8082
build:
  containerPort: 8443
`);
      yaml.load.mockReturnValue({
        port: 8082,
        build: { containerPort: 8443 }
      });

      const result = secretsUtils.resolveUrlPort(httpsProtocol, hostname, port, urlPath, hostnameToService);

      expect(result).toBe(`${httpsProtocol}${hostname}:8443${urlPath}`);
    });

    it('should handle empty URL path', () => {
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'application.yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
port: 8082
build:
  containerPort: 8080
`);
      yaml.load.mockReturnValue({
        port: 8082,
        build: { containerPort: 8080 }
      });

      const result = secretsUtils.resolveUrlPort(protocol, hostname, port, '', hostnameToService);

      expect(result).toBe(`${protocol}${hostname}:8080`);
    });

    it('should handle different service names', () => {
      const misoHostname = 'miso-controller';
      const misoHostnameToService = { 'miso-controller': 'miso-controller' };
      const serviceVariablesPath = path.join(process.cwd(), 'builder', 'miso-controller', 'application.yaml');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
port: 3010
build:
  containerPort: 3000
`);
      yaml.load.mockReturnValue({
        port: 3010,
        build: { containerPort: 3000 }
      });

      const result = secretsUtils.resolveUrlPort(protocol, misoHostname, '3010', urlPath, misoHostnameToService);

      expect(result).toBe(`${protocol}${misoHostname}:3000${urlPath}`);
    });
  });
});

