/**
 * Tests for secure command
 *
 * @fileoverview Tests for secure command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock dependencies BEFORE requiring any modules
jest.mock('fs');
jest.mock('os');

// Mock chalk before inquirer (inquirer depends on chalk)
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.magenta = jest.fn((text) => text);
  mockChalk.white = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  mockChalk.dim = jest.fn((text) => text);
  return mockChalk;
});

// Mock inquirer after chalk
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock config BEFORE requiring secure command
jest.mock('../../../lib/config', () => ({
  getSecretsEncryptionKey: jest.fn(),
  setSecretsEncryptionKey: jest.fn(),
  getSecretsPath: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const inquirer = require('inquirer');

const { handleSecure } = require('../../../lib/commands/secure');
const config = require('../../../lib/config');
const { encryptSecret, isEncrypted } = require('../../../lib/utils/secrets-encryption');
const logger = require('../../../lib/utils/logger');

describe('secure command', () => {
  const mockHomeDir = '/home/test';
  const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
  const validHexKey = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables to prevent supports-color issues
    process.env.FORCE_COLOR = '0';
    process.env.NO_COLOR = '1';
    process.env.TERM = 'dumb';

    os.homedir.mockReturnValue(mockHomeDir);
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('');
    fs.writeFileSync.mockImplementation(() => {});
    fs.readdirSync.mockReturnValue([]);
    inquirer.prompt.mockResolvedValue({});
    config.getSecretsEncryptionKey.mockResolvedValue(null);
    config.setSecretsEncryptionKey.mockResolvedValue();
    config.getSecretsPath.mockResolvedValue(null);
  });

  describe('handleSecure', () => {
    it('should set encryption key when provided via options', async() => {
      const options = { secretsEncryption: validHexKey };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(config.setSecretsEncryptionKey).toHaveBeenCalledWith(validHexKey);
    });

    it('should prompt for encryption key when not provided', async() => {
      const options = {};
      inquirer.prompt.mockResolvedValue({ key: validHexKey });
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(inquirer.prompt).toHaveBeenCalled();
      expect(config.setSecretsEncryptionKey).toHaveBeenCalledWith(validHexKey);
    });

    it('should use existing key from config if user confirms', async() => {
      const options = {};
      config.getSecretsEncryptionKey.mockResolvedValue(validHexKey);
      inquirer.prompt.mockResolvedValue({ use: true });
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(config.setSecretsEncryptionKey).not.toHaveBeenCalled();
    });

    it('should encrypt values in user secrets file', async() => {
      const options = { secretsEncryption: validHexKey };
      const secrets = {
        'test-key': 'test-value',
        'another-key': 'another-value'
      };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(secrets));

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      expect(writeCall).toBeDefined();

      const writtenContent = writeCall[1];
      const writtenSecrets = yaml.load(writtenContent);
      expect(isEncrypted(writtenSecrets['test-key'])).toBe(true);
      expect(isEncrypted(writtenSecrets['another-key'])).toBe(true);
    });

    it('should skip already encrypted values', async() => {
      const options = { secretsEncryption: validHexKey };
      const encryptedValue = encryptSecret('original', validHexKey);
      const secrets = {
        'encrypted-key': encryptedValue,
        'plain-key': 'plain-value'
      };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(secrets));

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      const writtenContent = writeCall[1];
      const writtenSecrets = yaml.load(writtenContent);

      // Encrypted value should remain the same
      expect(writtenSecrets['encrypted-key']).toBe(encryptedValue);
      // Plain value should be encrypted
      expect(isEncrypted(writtenSecrets['plain-key'])).toBe(true);
    });

    it('should find and encrypt app build secrets', async() => {
      const options = { secretsEncryption: validHexKey };
      const appName = 'test-app';
      const builderDir = path.join(process.cwd(), 'builder');
      const buildSecretsPath = path.join(process.cwd(), 'builder', appName, 'secrets.local.yaml');
      const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === mockSecretsPath ||
               filePath === variablesPath ||
               filePath === buildSecretsPath ||
               filePath === builderDir;
      });
      fs.readdirSync.mockReturnValue([
        { name: appName, isDirectory: () => true }
      ]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump({ build: { secrets: 'secrets.local.yaml' } });
        }
        if (filePath === buildSecretsPath) {
          return yaml.dump({ 'app-secret': 'app-value' });
        }
        return yaml.dump({});
      });

      await handleSecure(options);

      // Should have written to both user and build secrets files
      const writeCalls = fs.writeFileSync.mock.calls;
      expect(writeCalls.length).toBeGreaterThan(0);
    });

    it('should handle empty secrets files', async() => {
      const options = { secretsEncryption: validHexKey };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({}));

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle missing secrets files gracefully', async() => {
      const options = { secretsEncryption: validHexKey };
      fs.existsSync.mockReturnValue(false);

      await handleSecure(options);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No secrets files found'));
    });

    it('should preserve non-string values', async() => {
      const options = { secretsEncryption: validHexKey };
      const secrets = {
        'string-key': 'value',
        'number-key': 123,
        'null-key': null,
        'empty-key': ''
      };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(secrets));

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      const writtenContent = writeCall[1];
      const writtenSecrets = yaml.load(writtenContent);

      expect(writtenSecrets['string-key']).toBeDefined();
      expect(writtenSecrets['number-key']).toBe(123);
      expect(writtenSecrets['null-key']).toBeNull();
    });

    it('should handle errors during encryption gracefully', async() => {
      const options = { secretsEncryption: validHexKey };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      await expect(handleSecure(options)).resolves.not.toThrow();
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Error'));
    });

    it('should validate encryption key format', async() => {
      const options = { secretsEncryption: 'invalid-key' };
      fs.existsSync.mockReturnValue(true);

      await expect(handleSecure(options)).rejects.toThrow();
      expect(config.setSecretsEncryptionKey).not.toHaveBeenCalled();
    });

    it('should check config.yaml for general secrets-path', async() => {
      const options = { secretsEncryption: validHexKey };
      const generalSecretsPath = '/path/to/general/secrets.yaml';
      config.getSecretsPath.mockResolvedValue(generalSecretsPath);
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === generalSecretsPath;
      });
      fs.readFileSync.mockReturnValue(yaml.dump({ 'general-secret': 'value' }));

      await handleSecure(options);

      expect(config.getSecretsPath).toHaveBeenCalled();
      const writeCalls = fs.writeFileSync.mock.calls;
      const generalWriteCall = writeCalls.find(call => call[0] === generalSecretsPath);
      expect(generalWriteCall).toBeDefined();
    });

    it('should handle invalid secrets file format gracefully', async() => {
      const options = { secretsEncryption: validHexKey };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [');

      // Should not throw, but may not encrypt anything due to invalid format
      await expect(handleSecure(options)).resolves.not.toThrow();
    });

    it('should handle non-object secrets file gracefully', async() => {
      const options = { secretsEncryption: validHexKey };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('not an object');

      // Should not throw, but may not encrypt anything due to invalid format
      await expect(handleSecure(options)).resolves.not.toThrow();
    });

    it('should prompt for new key when user declines existing key', async() => {
      const options = {};
      config.getSecretsEncryptionKey.mockResolvedValue(validHexKey);
      inquirer.prompt
        .mockResolvedValueOnce({ use: false }) // Decline existing key
        .mockResolvedValueOnce({ key: validHexKey }); // Provide new key
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(config.setSecretsEncryptionKey).toHaveBeenCalledWith(validHexKey);
      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
    });

    it('should handle prompt validation error for empty key', async() => {
      const options = {};
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      // Mock inquirer to test validation function
      inquirer.prompt.mockImplementation((questions) => {
        const question = questions[0];
        // Test validation with empty key - should return error message
        const validationResult = question.validate('');
        expect(validationResult).toBe('Encryption key is required');
        // Return valid key (simulating user entering valid key after validation error)
        return Promise.resolve({ key: validHexKey });
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(config.setSecretsEncryptionKey).toHaveBeenCalledWith(validHexKey);
    });

    it('should handle prompt validation error for invalid key format', async() => {
      const options = {};
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      // Mock inquirer to simulate validation - test that validation function works
      inquirer.prompt.mockImplementation((questions) => {
        const question = questions[0];
        // Test validation with invalid key - should return error message
        const validationResult = question.validate('invalid-key');
        expect(typeof validationResult).toBe('string'); // Should return error message
        expect(validationResult).toContain('Encryption key must be 32 bytes');
        // Return valid key (simulating user entering valid key after validation error)
        return Promise.resolve({ key: validHexKey });
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(config.setSecretsEncryptionKey).toHaveBeenCalledWith(validHexKey);
    });

    it('should handle prompt validation with whitespace-only key', async() => {
      const options = {};
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      // Mock inquirer to simulate validation failure with whitespace
      inquirer.prompt.mockImplementation((questions) => {
        const question = questions[0];
        const validationResult = question.validate('   ');
        expect(validationResult).toBe('Encryption key is required');
        // Return valid key after validation
        return Promise.resolve({ key: validHexKey });
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(config.setSecretsEncryptionKey).toHaveBeenCalledWith(validHexKey);
    });

    it('should validate prompt with valid key format', async() => {
      const options = {};
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      // Mock inquirer to test validation success path
      inquirer.prompt.mockImplementation((questions) => {
        const question = questions[0];
        // Test validation with valid key - should return true
        const validationResult = question.validate(validHexKey);
        expect(validationResult).toBe(true);
        // Return valid key
        return Promise.resolve({ key: validHexKey });
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(config.setSecretsEncryptionKey).toHaveBeenCalledWith(validHexKey);
    });

    it('should handle findSecretsFiles when builder directory does not exist', async() => {
      const options = { secretsEncryption: validHexKey };
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSecretsPath) return true;
        if (filePath.includes('builder')) return false;
        return false;
      });
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle findSecretsFiles when builder directory read fails', async() => {
      const options = { secretsEncryption: validHexKey };
      const builderDir = path.join(process.cwd(), 'builder');
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSecretsPath) return true;
        if (filePath === builderDir) return true;
        return false;
      });
      fs.readdirSync.mockImplementation(() => {
        throw new Error('Read error');
      });
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      // Should still process user secrets file
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle findSecretsFiles when variables.yaml read fails', async() => {
      const options = { secretsEncryption: validHexKey };
      const appName = 'test-app';
      const builderDir = path.join(process.cwd(), 'builder');
      const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSecretsPath) return true;
        if (filePath === builderDir) return true;
        if (filePath === variablesPath) return true;
        return false;
      });
      fs.readdirSync.mockReturnValue([
        { name: appName, isDirectory: () => true }
      ]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          throw new Error('Read error');
        }
        return yaml.dump({ 'test-key': 'test-value' });
      });

      await handleSecure(options);

      // Should still process user secrets file
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle findSecretsFiles when variables.yaml has invalid YAML', async() => {
      const options = { secretsEncryption: validHexKey };
      const appName = 'test-app';
      const builderDir = path.join(process.cwd(), 'builder');
      const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSecretsPath) return true;
        if (filePath === builderDir) return true;
        if (filePath === variablesPath) return true;
        return false;
      });
      fs.readdirSync.mockReturnValue([
        { name: appName, isDirectory: () => true }
      ]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return 'invalid: yaml: [';
        }
        return yaml.dump({ 'test-key': 'test-value' });
      });

      await handleSecure(options);

      // Should still process user secrets file
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle findSecretsFiles when app entry is not a directory', async() => {
      const options = { secretsEncryption: validHexKey };
      const builderDir = path.join(process.cwd(), 'builder');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSecretsPath) return true;
        if (filePath === builderDir) return true;
        return false;
      });
      fs.readdirSync.mockReturnValue([
        { name: 'file.txt', isDirectory: () => false } // Not a directory
      ]);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle findSecretsFiles when build.secrets file does not exist', async() => {
      const options = { secretsEncryption: validHexKey };
      const appName = 'test-app';
      const builderDir = path.join(process.cwd(), 'builder');
      const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
      const buildSecretsPath = path.join(process.cwd(), 'builder', appName, 'secrets.local.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === mockSecretsPath) return true;
        if (filePath === builderDir) return true;
        if (filePath === variablesPath) return true;
        if (filePath === buildSecretsPath) return false; // Build secrets doesn't exist
        return false;
      });
      fs.readdirSync.mockReturnValue([
        { name: appName, isDirectory: () => true }
      ]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return yaml.dump({ build: { secrets: 'secrets.local.yaml' } });
        }
        return yaml.dump({ 'test-key': 'test-value' });
      });

      await handleSecure(options);

      // Should only process user secrets file
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle findSecretsFiles when getSecretsPath fails', async() => {
      const options = { secretsEncryption: validHexKey };
      config.getSecretsPath.mockRejectedValue(new Error('Config error'));
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      // Should still process user secrets file
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle findSecretsFiles with relative general secrets path', async() => {
      const options = { secretsEncryption: validHexKey };
      const relativePath = '../../secrets.local.yaml';
      const resolvedPath = path.resolve(process.cwd(), relativePath);
      config.getSecretsPath.mockResolvedValue(relativePath);
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === resolvedPath;
      });
      fs.readFileSync.mockReturnValue(yaml.dump({ 'general-secret': 'value' }));

      await handleSecure(options);

      expect(config.getSecretsPath).toHaveBeenCalled();
      const writeCalls = fs.writeFileSync.mock.calls;
      const generalWriteCall = writeCalls.find(call => call[0] === resolvedPath);
      expect(generalWriteCall).toBeDefined();
    });

    it('should skip general secrets path if already in files list', async() => {
      const options = { secretsEncryption: validHexKey };
      const generalSecretsPath = mockSecretsPath; // Same as user path
      config.getSecretsPath.mockResolvedValue(generalSecretsPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      // Should only write once (not duplicate)
      const writeCalls = fs.writeFileSync.mock.calls.filter(call => call[0] === mockSecretsPath);
      expect(writeCalls.length).toBe(1);
    });

    it('should handle encryptSecretsFile with empty string values', async() => {
      const options = { secretsEncryption: validHexKey };
      const secrets = {
        'empty-key': '',
        'whitespace-key': '   ',
        'valid-key': 'value'
      };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(secrets));

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      const writtenContent = writeCall[1];
      const writtenSecrets = yaml.load(writtenContent);

      // Empty and whitespace values should remain unchanged
      expect(writtenSecrets['empty-key']).toBe('');
      expect(writtenSecrets['whitespace-key']).toBe('   ');
      // Valid value should be encrypted
      expect(isEncrypted(writtenSecrets['valid-key'])).toBe(true);
    });

    it('should handle options with secrets-encryption key (alternative format)', async() => {
      const options = { 'secrets-encryption': validHexKey };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({ 'test-key': 'test-value' }));

      await handleSecure(options);

      expect(config.setSecretsEncryptionKey).toHaveBeenCalledWith(validHexKey);
    });

    it('should preserve comments when encrypting', async() => {
      const options = { secretsEncryption: validHexKey };
      const originalContent = `# Header comment
# Another comment

key1: value1 # inline comment
key2: value2
# Section comment
key3: value3
`;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(originalContent);

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      expect(writeCall).toBeDefined();

      const writtenContent = writeCall[1];

      // Verify comments are preserved
      expect(writtenContent).toContain('# Header comment');
      expect(writtenContent).toContain('# Another comment');
      expect(writtenContent).toContain('# inline comment');
      expect(writtenContent).toContain('# Section comment');

      // Verify blank lines are preserved
      const lines = writtenContent.split('\n');
      expect(lines[2]).toBe(''); // Blank line after comments
    });

    it('should preserve formatting and indentation', async() => {
      const options = { secretsEncryption: validHexKey };
      const originalContent = `  key1: value1
    key2: value2
key3: value3
`;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(originalContent);

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      const writtenContent = writeCall[1];

      // Verify indentation is preserved
      expect(writtenContent).toContain('  key1:');
      expect(writtenContent).toContain('    key2:');
      expect(writtenContent).toContain('key3:');
    });

    it('should skip encrypting http:// URLs', async() => {
      const options = { secretsEncryption: validHexKey };
      const originalContent = `http-url: http://localhost:3000
secret-key: my-secret-value
`;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(originalContent);

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      const writtenContent = writeCall[1];

      // URL should not be encrypted
      expect(writtenContent).toContain('http://localhost:3000');

      // Secret should be encrypted
      expect(writtenContent).not.toContain('my-secret-value');
      expect(writtenContent).toMatch(/secret-key: secure:\/\//);
    });

    it('should skip encrypting https:// URLs', async() => {
      const options = { secretsEncryption: validHexKey };
      const originalContent = `https-url: https://api.example.com
secret-key: my-secret-value
`;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(originalContent);

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      const writtenContent = writeCall[1];

      // URL should not be encrypted
      expect(writtenContent).toContain('https://api.example.com');

      // Secret should be encrypted
      expect(writtenContent).not.toContain('my-secret-value');
      expect(writtenContent).toMatch(/secret-key: secure:\/\//);
    });

    it('should skip encrypting URLs even when quoted', async() => {
      const options = { secretsEncryption: validHexKey };
      const originalContent = `url1: "http://example.com"
url2: 'https://api.example.com'
secret: my-secret
`;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(originalContent);

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      const writtenContent = writeCall[1];

      // URLs should not be encrypted even if quoted
      expect(writtenContent).toContain('"http://example.com"');
      expect(writtenContent).toContain('\'https://api.example.com\'');

      // Secret should be encrypted
      expect(writtenContent).toMatch(/secret: secure:\/\//);
    });

    it('should preserve comments and skip URLs in complex file', async() => {
      const options = { secretsEncryption: validHexKey };
      const originalContent = `# Configuration file
# Contains secrets and URLs

# Database URL (not a secret)
database-url: https://db.example.com

# API Key (secret)
api-key: my-api-key-123

# Service endpoint (not a secret)
service-url: http://localhost:8080

# Another secret
secret-token: my-secret-token
`;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(originalContent);

      await handleSecure(options);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      const writtenContent = writeCall[1];

      // All comments should be preserved
      expect(writtenContent).toContain('# Configuration file');
      expect(writtenContent).toContain('# Contains secrets and URLs');
      expect(writtenContent).toContain('# Database URL (not a secret)');
      expect(writtenContent).toContain('# API Key (secret)');
      expect(writtenContent).toContain('# Service endpoint (not a secret)');
      expect(writtenContent).toContain('# Another secret');

      // URLs should not be encrypted
      expect(writtenContent).toContain('https://db.example.com');
      expect(writtenContent).toContain('http://localhost:8080');

      // Secrets should be encrypted
      expect(writtenContent).not.toContain('my-api-key-123');
      expect(writtenContent).not.toContain('my-secret-token');
      expect(writtenContent).toMatch(/api-key: secure:\/\//);
      expect(writtenContent).toMatch(/secret-token: secure:\/\//);
    });
  });
});

