/**
 * Tests for AI Fabrix Builder Secrets Generator Module
 *
 * @fileoverview Unit tests for secrets-generator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const crypto = require('crypto');

// Mock logger before requiring modules that use it
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

const secretsGenerator = require('../../../lib/utils/secrets-generator');
const pathsUtil = require('../../../lib/utils/paths');
const infraParameterCatalog = require('../../../lib/parameters/infra-parameter-catalog');
const { clearInfraParameterCatalogCache, loadInfraParameterCatalog, DEFAULT_CATALOG_PATH } =
  infraParameterCatalog;

// Mock fs module
jest.mock('fs');
jest.mock('os');
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn()
}));

describe('Secrets Generator Module', () => {
  const mockHomeDir = '/home/test';
  const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

  afterAll(() => {
    fs.existsSync.mockImplementation(() => false);
    fs.readFileSync.mockImplementation(() => '');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    // Default paths.getAifabrixHome() to return mockHomeDir/.aifabrix
    pathsUtil.getAifabrixHome.mockReturnValue(path.join(mockHomeDir, '.aifabrix'));
  });

  describe('findMissingSecretKeys', () => {
    it('should find missing secret keys from template', () => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault\nREDIS_URL=kv://redis-url';
      const existingSecrets = { 'postgres-passwordKeyVault': 'admin123' };

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual(['redis-url']);
    });

    it('should return empty array when all secrets exist', () => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      const existingSecrets = { 'postgres-passwordKeyVault': 'admin123' };

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual([]);
    });

    it('should return all keys when no secrets exist', () => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault\nREDIS_URL=kv://redis-url';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual(['postgres-passwordKeyVault', 'redis-url']);
    });

    it('should handle duplicate kv:// references', () => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault\nOTHER_URL=kv://postgres-passwordKeyVault';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual(['postgres-passwordKeyVault']);
    });

    it('should skip commented and empty lines', () => {
      const envTemplate = [
        '# Environment variables for external system integration',
        '',
        '# OAuth2 Authentication',
        '#CLIENT_ID=kv://secrets/client-id',
        '#CLIENT_SECRET=kv://secrets/client-secret',
        'ACTIVE_KEY=kv://active-secret'
      ].join('\n');
      const existingSecrets = { 'active-secret': 'value' };

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual([]);
    });

    it('should handle empty template', () => {
      const envTemplate = '';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual([]);
    });

    it('should handle template with no kv:// references', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost:5432/db';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual([]);
    });

    it('should handle keys with hyphens and underscores', () => {
      const envTemplate = 'KEY1=kv://my-app-key\nKEY2=kv://my_app_key';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual(['my-app-key', 'my_app_key']);
    });
  });

  describe('generateSecretValue', () => {
    const realFs = jest.requireActual('fs');

    beforeEach(() => {
      clearInfraParameterCatalogCache();
      fs.existsSync.mockImplementation((filePath) => {
        const s = String(filePath);
        if (s.includes('infra.parameter.yaml') || s.includes('infra-parameter.schema.json')) {
          return realFs.existsSync(filePath);
        }
        if (s.includes(`${path.sep}templates${path.sep}applications${path.sep}`)) {
          return realFs.existsSync(filePath);
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath, encoding) => {
        const s = String(filePath);
        if (s.includes('infra.parameter.yaml') || s.includes('infra-parameter.schema.json')) {
          return realFs.readFileSync(filePath, encoding);
        }
        if (s.includes(`${path.sep}templates${path.sep}applications${path.sep}`)) {
          return realFs.readFileSync(filePath, encoding);
        }
        return '';
      });
    });

    afterEach(() => {
      // Do not mockReset (strips impl) or delegate to realFs (leaks real I/O into other worker suites).
      fs.existsSync.mockImplementation(() => false);
      fs.readFileSync.mockImplementation(() => '');
    });

    it('should generate default semver for catalog key version (kv://version backfill)', () => {
      expect(secretsGenerator.generateSecretValue('version')).toBe('1.0.0');
    });

    it('should generate database password for databases-{app}-{index}-passwordKeyVault format', () => {
      const key = 'databases-myapp-0-passwordKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('myapp_pass123');
    });

    it('should handle app name with hyphens in database password', () => {
      const key = 'databases-my-app-name-0-passwordKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('my_app_name_pass123');
    });

    it('should generate miso_pass123 for miso-controller database password to match infra init script', () => {
      const key = 'databases-miso-controller-0-passwordKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('miso_pass123');
    });

    it('should generate randomBytes32 for *KeyVault keys via catalog catch-all', () => {
      const key = 'custom-generated-secretKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(44);
    });

    it('should generate database URL for databases-{app}-{index}-urlKeyVault format', () => {
      const key = 'databases-myapp-0-urlKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('postgresql://myapp_user:myapp_pass123@${DB_HOST}:${DB_PORT}/myapp');
    });

    it('should handle app name with hyphens in database URL', () => {
      const key = 'databases-my-app-name-0-urlKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('postgresql://my_app_name_user:my_app_name_pass123@${DB_HOST}:${DB_PORT}/my_app_name');
    });

    it('should generate miso_user/miso db URL for miso-controller to match infra init script', () => {
      const key = 'databases-miso-controller-0-urlKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('postgresql://miso_user:miso_pass123@${DB_HOST}:${DB_PORT}/miso');
    });

    it('should generate miso_logs_user / miso-logs URL for miso-controller database index 1', () => {
      const key = 'databases-miso-controller-1-urlKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe(
        'postgresql://miso_logs_user:miso_logs_pass123@${DB_HOST}:${DB_PORT}/miso-logs'
      );
    });

    it('should generate miso_logs_pass123 for miso-controller database index 1 password', () => {
      const key = 'databases-miso-controller-1-passwordKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('miso_logs_pass123');
    });

    it('should return empty string for *-url keys via catalog (non-database)', () => {
      expect(secretsGenerator.generateSecretValue('acme-placeholder-url')).toBe('');
    });

    it('should throw when catalog loads but key matches no rule', () => {
      expect(() => secretsGenerator.generateSecretValue('some-unknown-value-setting')).toThrow(
        /no matching rule in infra\.parameter\.yaml/
      );
    });

    it('should generate randomBytes32 for KeyVault-suffixed API secret keys', () => {
      const key = 'custom-api-secretKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result.length).toBe(44);
    });

    it('should generate randomBytes32 for KeyVault-suffixed shared secret keys', () => {
      const key = 'custom-shared-secretKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result.length).toBe(44);
    });

    it('should generate randomBytes32 for KeyVault-suffixed token keys', () => {
      const key = 'custom-token-secretKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result.length).toBe(44);
    });

    it('should use catalog literal for miso-controller onboarding admin email', () => {
      expect(secretsGenerator.generateSecretValue('miso-controller-admin-emailKeyVault')).toBe('admin@aifabrix.dev');
    });

    it('should use catalog literal for miso-controller onboarding admin password (local default)', () => {
      expect(secretsGenerator.generateSecretValue('miso-controller-admin-passwordKeyVault')).toBe('admin123');
    });

    it('should apply placeholderContext for shared {{adminPassword}} literals', () => {
      clearInfraParameterCatalogCache();
      expect(
        secretsGenerator.generateSecretValue('postgres-passwordKeyVault', {
          adminPassword: 'from-cli',
          adminEmail: 'e@e.e',
          userPassword: 'uu'
        })
      ).toBe('from-cli');
      expect(
        secretsGenerator.generateSecretValue('keycloak-default-passwordKeyVault', {
          adminPassword: 'x',
          userPassword: 'uu'
        })
      ).toBe('uu');
    });

    it('should use catalog password generator (8-char [a-zA-Z0-9])', () => {
      const realCat = loadInfraParameterCatalog(DEFAULT_CATALOG_PATH);
      const spy = jest.spyOn(infraParameterCatalog, 'getInfraParameterCatalog').mockImplementation(() => ({
        findEntryForKey: (key) => {
          if (key === 'jest-password-generator-demoKeyVault') {
            return { generator: { type: 'password' }, ensureOn: ['resolveApp'] };
          }
          return realCat.findEntryForKey(key);
        }
      }));
      try {
        clearInfraParameterCatalogCache();
        const v = secretsGenerator.generateSecretValue('jest-password-generator-demoKeyVault');
        expect(v).toHaveLength(8);
        expect(v).toMatch(/^[a-zA-Z0-9]+$/);
      } finally {
        spy.mockRestore();
        clearInfraParameterCatalogCache();
      }
    });
  });

  describe('loadYamlTolerantOfDuplicateKeys', () => {
    it('should return parsed object when YAML is valid', () => {
      const content = 'a: 1\nb: 2';
      const result = secretsGenerator.loadYamlTolerantOfDuplicateKeys(content);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should tolerate duplicate keys and use last value', () => {
      const content = 'key: first\nkey: last';
      const result = secretsGenerator.loadYamlTolerantOfDuplicateKeys(content);
      expect(result).toEqual({ key: 'last' });
    });

    it('should return empty object for empty or null content', () => {
      expect(secretsGenerator.loadYamlTolerantOfDuplicateKeys('')).toEqual({});
      expect(secretsGenerator.loadYamlTolerantOfDuplicateKeys(null)).toEqual({});
    });

    it('falls back to line parse when strict YAML fails (e.g. unclosed bracket)', () => {
      const r = secretsGenerator.loadYamlTolerantOfDuplicateKeys('invalid: [unclosed');
      expect(r).toEqual({ invalid: '[unclosed' });
    });

    it('recovers {} then appended key lines (invalid multi-document concat)', () => {
      const content = '{}\nmiso-controller-admin-passwordKeyVault: secret123\n';
      expect(secretsGenerator.loadYamlTolerantOfDuplicateKeys(content)).toEqual({
        'miso-controller-admin-passwordKeyVault': 'secret123'
      });
    });
  });

  describe('loadExistingSecrets', () => {
    it('should return empty object when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
      expect(fs.existsSync).toHaveBeenCalledWith(mockSecretsPath);
    });

    it('should load existing secrets from file', () => {
      const mockSecrets = { 'postgres-passwordKeyVault': 'admin123' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockSecrets));

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual(mockSecrets);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockSecretsPath, 'utf8');
    });

    it('should return empty object when file contains null', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('null');

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
    });

    it('should return empty object when file contains non-object', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('"just a string"');

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
    });

    it('should handle error when reading file', () => {
      const logger = require('../../../lib/utils/logger');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not read existing secrets file'));
    });

    it('should handle empty file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('');

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
    });

    it('should handle invalid YAML gracefully (line parse yields no keys)', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('not yaml {{{ no key value pairs');

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
    });

    it('should tolerate duplicate keys and use last value (loadYamlTolerantOfDuplicateKeys)', () => {
      fs.existsSync.mockReturnValue(true);
      const contentWithDuplicates = [
        'dataplane-client-idKeyVault: first-id',
        'dataplane-client-secretKeyVault: first-secret',
        'dataplane-client-idKeyVault: last-id',
        'dataplane-client-secretKeyVault: last-secret'
      ].join('\n');
      fs.readFileSync.mockReturnValue(contentWithDuplicates);

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result['dataplane-client-idKeyVault']).toBe('last-id');
      expect(result['dataplane-client-secretKeyVault']).toBe('last-secret');
    });
  });

  describe('saveSecretsFile', () => {
    it('should save secrets file', () => {
      const secrets = { 'postgres-passwordKeyVault': 'admin123' };
      fs.existsSync.mockReturnValue(true);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockSecretsPath,
        expect.stringContaining('postgres-passwordKeyVault'),
        { mode: 0o600 }
      );
    });

    it('should create directory if it does not exist', () => {
      const secrets = { 'postgres-passwordKeyVault': 'admin123' };
      const dir = path.dirname(mockSecretsPath);
      fs.existsSync.mockReturnValue(false);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should not create directory if it exists', () => {
      const secrets = { 'postgres-passwordKeyVault': 'admin123' };
      const dir = path.dirname(mockSecretsPath);
      fs.existsSync.mockImplementation((filePath) => filePath === dir);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should save secrets with proper YAML formatting', () => {
      const secrets = {
        'postgres-passwordKeyVault': 'admin123',
        'redis-url': 'redis://localhost:6379'
      };
      fs.existsSync.mockReturnValue(true);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const yamlContent = writeCall[1];
      const parsed = yaml.load(yamlContent);

      expect(parsed).toEqual(secrets);
    });

    it('should preserve key order in YAML output', () => {
      const secrets = {
        'z-key': 'value-z',
        'a-key': 'value-a',
        'm-key': 'value-m'
      };
      fs.existsSync.mockReturnValue(true);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const yamlContent = writeCall[1];
      const parsed = yaml.load(yamlContent);

      expect(Object.keys(parsed)).toEqual(['z-key', 'a-key', 'm-key']);
    });
  });

  describe('appendSecretsToFile', () => {
    it('should create file with secrets when file does not exist', () => {
      const secrets = { 'new-key': 'new-value' };
      fs.existsSync.mockReturnValue(false);

      secretsGenerator.appendSecretsToFile(mockSecretsPath, secrets);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockSecretsPath,
        expect.stringContaining('new-key'),
        { mode: 0o600 }
      );
    });

    it('should append secrets to end of existing file without changing existing content', () => {
      const existingContent = '# My comments\nold-key: old-value\n';
      const secrets = { 'new-key': 'new-value' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(existingContent);

      secretsGenerator.appendSecretsToFile(mockSecretsPath, secrets);

      expect(fs.readFileSync).toHaveBeenCalledWith(mockSecretsPath, 'utf8');
      const writeCall = fs.writeFileSync.mock.calls[0];
      expect(writeCall[1]).toContain('# My comments');
      expect(writeCall[1]).toContain('old-key: old-value');
      expect(writeCall[1]).toContain('new-key');
      expect(writeCall[1]).toContain('new-value');
    });

    it('rewrites file when strict YAML fails (e.g. {} plus appended keys)', () => {
      const broken = '{}\nold-key: old-value\n';
      const secrets = { 'new-key': 'new-value' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(broken);

      secretsGenerator.appendSecretsToFile(mockSecretsPath, secrets);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const parsed = yaml.load(writeCall[1]);
      expect(parsed['old-key']).toBe('old-value');
      expect(parsed['new-key']).toBe('new-value');
    });

    it('should do nothing when secrets object is empty', () => {
      fs.existsSync.mockReturnValue(true);
      secretsGenerator.appendSecretsToFile(mockSecretsPath, {});
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('mergeSecretsIntoFile', () => {
    it('should create file with secrets when file does not exist', () => {
      const secrets = { 'new-key': 'new-value' };
      fs.existsSync.mockReturnValue(false);

      secretsGenerator.mergeSecretsIntoFile(mockSecretsPath, secrets);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockSecretsPath,
        expect.stringContaining('new-key'),
        { mode: 0o600 }
      );
    });

    it('should update existing key in place (no duplicate keys)', () => {
      const existingContent = 'dataplane-client-idKeyVault: old-id\ndataplane-client-secretKeyVault: old-secret\n';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(existingContent);

      secretsGenerator.mergeSecretsIntoFile(mockSecretsPath, {
        'dataplane-client-idKeyVault': 'new-id',
        'dataplane-client-secretKeyVault': 'new-secret'
      });

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      const parsed = yaml.load(writtenContent);
      expect(parsed['dataplane-client-idKeyVault']).toBe('new-id');
      expect(parsed['dataplane-client-secretKeyVault']).toBe('new-secret');
      expect(Object.keys(parsed)).toHaveLength(2);
    });

    it('should do nothing when secrets object is empty', () => {
      fs.existsSync.mockReturnValue(true);
      secretsGenerator.mergeSecretsIntoFile(mockSecretsPath, {});
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should preserve other keys when merging one key', () => {
      const existingContent = 'key1: val1\nkey2: val2-old\nkey3: val3\n';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(existingContent);

      secretsGenerator.mergeSecretsIntoFile(mockSecretsPath, { key2: 'val2-new' });

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      const parsed = yaml.load(writtenContent);
      expect(parsed.key1).toBe('val1');
      expect(parsed.key2).toBe('val2-new');
      expect(parsed.key3).toBe('val3');
      expect(Object.keys(parsed)).toHaveLength(3);
    });

    it('should deduplicate when existing file has duplicate keys (tolerant load)', () => {
      const existingContent = 'dataplane-client-idKeyVault: old-id\ndataplane-client-idKeyVault: older-id\ndataplane-client-secretKeyVault: old-secret\n';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(existingContent);

      secretsGenerator.mergeSecretsIntoFile(mockSecretsPath, {
        'dataplane-client-idKeyVault': 'new-id',
        'dataplane-client-secretKeyVault': 'new-secret'
      });

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      const parsed = yaml.load(writtenContent);
      expect(parsed['dataplane-client-idKeyVault']).toBe('new-id');
      expect(parsed['dataplane-client-secretKeyVault']).toBe('new-secret');
      expect(Object.keys(parsed)).toHaveLength(2);
    });
  });

  describe('generateMissingSecrets', () => {
    beforeEach(() => {
      const logger = require('../../../lib/utils/logger');
      jest.clearAllMocks();
      logger.log.mockClear();
    });

    it('should generate missing secrets', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(false);

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toEqual(['postgres-passwordKeyVault']);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should return empty array when no missing keys', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: "admin123"');

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toEqual([]);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should use default path when secretsPath not provided', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      const defaultPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate);

      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === defaultPath);
      expect(writeCall).toBeDefined();
    });

    it('should respect config.yaml aifabrix-home override when path not provided', async() => {
      const overrideHome = '/custom/aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.yaml');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate);

      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === overrideSecretsPath);
      expect(writeCall).toBeDefined();
    });

    it('should use provided path and not use fallback', async() => {
      const explicitPath = '/explicit/path/secrets.yaml';
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate, explicitPath);

      expect(pathsUtil.getAifabrixHome).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === explicitPath);
      expect(writeCall).toBeDefined();
    });

    it('should merge new secrets with existing ones', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault\nREDIS_URL=kv://redis-url';
      const existingSecrets = { 'postgres-passwordKeyVault': 'admin123' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(existingSecrets));

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls[0];
      const writtenContent = writeCall[1];
      const parsed = yaml.load(writtenContent);

      expect(parsed['postgres-passwordKeyVault']).toBe('admin123');
      expect(parsed['redis-url']).toBeDefined();
    });

    it('should log generated keys', async() => {
      const logger = require('../../../lib/utils/logger');
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Generated 1 missing secret key(s)')
      );
    });

    it('should handle multiple missing keys', async() => {
      const envTemplate =
        'KEY1=kv://multi-missing-one-secretKeyVault\nKEY2=kv://multi-missing-two-secretKeyVault';
      fs.existsSync.mockReturnValue(false);

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toEqual(['multi-missing-one-secretKeyVault', 'multi-missing-two-secretKeyVault']);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle existing secrets file with invalid YAML', async() => {
      const logger = require('../../../lib/utils/logger');
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      const dir = path.dirname(mockSecretsPath);
      fs.existsSync.mockImplementation((filePath) => filePath === mockSecretsPath);

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true, mode: 0o700 });
    });

    it('should handle duplicate kv:// references', async() => {
      const envTemplate =
        'KEY1=kv://duplicate-test-secretKeyVault\nKEY2=kv://duplicate-test-secretKeyVault';
      fs.existsSync.mockReturnValue(false);

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toEqual(['duplicate-test-secretKeyVault']);
    });
  });

  describe('createDefaultSecrets', () => {
    it('should create default secrets file with ~ path', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('postgres-passwordKeyVault'),
        { mode: 0o600 }
      );
    });

    it('should create default secrets file with absolute path', async() => {
      const secretsPath = '/custom/path/secrets.yaml';
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        secretsPath,
        expect.stringContaining('postgres-passwordKeyVault'),
        { mode: 0o600 }
      );
    });

    it('should create directory if it does not exist', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      const dir = path.dirname(resolvedPath);
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should include all default secrets in output', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const content = writeCall[1];

      expect(content).toContain('postgres-passwordKeyVault');
      expect(content).toContain('redis-passwordKeyVault');
      expect(content).toContain('redis-url');
      expect(content).toContain('keycloak-admin-passwordKeyVault');
      expect(content).toContain('keycloak-server-url:');
    });

    it('should write file with correct permissions', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should handle path without ~ prefix', async() => {
      const secretsPath = '/absolute/path/secrets.yaml';
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        secretsPath,
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should not create directory if it already exists', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      const dir = path.dirname(resolvedPath);
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      // mkdirSync should still be called but won't create if exists
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('saveSecretsFile (preserve comments)', () => {
    it('preserves comments/blank lines and supports add/update/delete for flat secrets.local.yaml', () => {
      const target = '/home/user/.aifabrix/secrets.local.yaml';
      const existing =
        '# Header comment stays\n' +
        '\n' +
        'keepKey: keepVal # inline comment stays\n' +
        'updateKey: oldVal\n' +
        'deleteKey: bye\n';

      fs.existsSync.mockImplementation((p) => {
        if (p === path.dirname(target)) return true;
        if (p === target) return true;
        return true;
      });
      fs.readFileSync.mockReturnValue(existing);

      secretsGenerator.saveSecretsFile(target, {
        keepKey: 'keepVal',
        updateKey: 'newVal',
        addKey: 'added'
      });

      const written = fs.writeFileSync.mock.calls[0][1];
      expect(written).toContain('# Header comment stays');
      expect(written).toContain('keepKey: keepVal # inline comment stays');
      expect(written).toContain('updateKey: newVal');
      expect(written).toContain('addKey: added');
      expect(written).not.toContain('deleteKey:');
    });
  });

  describe('Integration tests', () => {
    it('should generate and save secrets in correct format', async() => {
      const envTemplate = `
DATABASE_PASSWORD=kv://databases-myapp-0-passwordKeyVault
DATABASE_URL=kv://databases-myapp-0-urlKeyVault
API_KEY=kv://myapp-api-key-secretKeyVault
`;
      fs.existsSync.mockReturnValue(false);

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toContain('databases-myapp-0-passwordKeyVault');
      expect(result).toContain('databases-myapp-0-urlKeyVault');
      expect(result).toContain('myapp-api-key-secretKeyVault');

      const writeCall = fs.writeFileSync.mock.calls[0];
      const yamlContent = writeCall[1];
      const parsed = yaml.load(yamlContent);

      expect(parsed['databases-myapp-0-passwordKeyVault']).toBe('myapp_pass123');
      expect(parsed['databases-myapp-0-urlKeyVault']).toBe('postgresql://myapp_user:myapp_pass123@${DB_HOST}:${DB_PORT}/myapp');
      expect(parsed['myapp-api-key-secretKeyVault']).toBeTruthy();
      expect(typeof parsed['myapp-api-key-secretKeyVault']).toBe('string');
      expect(parsed['myapp-api-key-secretKeyVault'].length).toBe(44);
    });

    it('should handle complex template with multiple secret types', async() => {
      const envTemplate = `
PASSWORD=kv://generic-passwordKeyVault
SECRET_KEY=kv://secret-key-sharedKeyVault
TOKEN=kv://api-token-secretKeyVault
URL=kv://integration-test-placeholder-url
`;
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const yamlContent = writeCall[1];
      const parsed = yaml.load(yamlContent);

      expect(parsed['generic-passwordKeyVault']).toBeTruthy();
      expect(parsed['secret-key-sharedKeyVault']).toBeTruthy();
      expect(parsed['api-token-secretKeyVault']).toBeTruthy();
      expect(parsed['integration-test-placeholder-url']).toBe('');
    });
  });
});

