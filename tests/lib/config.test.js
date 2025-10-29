/**
 * Tests for Config Module
 *
 * @fileoverview Tests for config.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { getConfig, saveConfig, clearConfig, CONFIG_DIR, CONFIG_FILE } = require('../../lib/config');

// Spy on fs.promises methods
jest.spyOn(fsPromises, 'readFile');
jest.spyOn(fsPromises, 'mkdir');
jest.spyOn(fsPromises, 'writeFile');
jest.spyOn(fsPromises, 'unlink');

describe('Config Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return config when file exists', async() => {
      const mockConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token-123'
      };

      fsPromises.readFile.mockResolvedValue(`apiUrl: ${mockConfig.apiUrl}\ntoken: ${mockConfig.token}`);

      const result = await getConfig();

      expect(result).toEqual(mockConfig);
      expect(fsPromises.readFile).toHaveBeenCalledWith(CONFIG_FILE, 'utf8');
    });

    it('should return null values when file does not exist', async() => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fsPromises.readFile.mockRejectedValue(error);

      const result = await getConfig();

      expect(result).toEqual({ apiUrl: null, token: null });
    });

    it('should throw error for other file errors', async() => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fsPromises.readFile.mockRejectedValue(error);

      await expect(getConfig()).rejects.toThrow('Failed to read config: Permission denied');
    });
  });

  describe('saveConfig', () => {
    it('should save config successfully', async() => {
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);

      const config = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token'
      };

      await saveConfig(config);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        CONFIG_FILE,
        expect.stringContaining('apiUrl:'),
        {
          mode: 0o600,
          flag: 'w'
        }
      );
    });

    it('should handle save errors', async() => {
      const error = new Error('Disk full');
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockRejectedValue(error);

      await expect(saveConfig({ apiUrl: 'test' })).rejects.toThrow('Failed to save config: Disk full');
    });
  });

  describe('clearConfig', () => {
    it('should delete config file', async() => {
      fsPromises.unlink.mockResolvedValue(undefined);

      await clearConfig();

      expect(fsPromises.unlink).toHaveBeenCalledWith(CONFIG_FILE);
    });

    it('should handle file not existing gracefully', async() => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fsPromises.unlink.mockRejectedValue(error);

      await expect(clearConfig()).resolves.not.toThrow();
    });

    it('should throw for other errors', async() => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fsPromises.unlink.mockRejectedValue(error);

      await expect(clearConfig()).rejects.toThrow('Failed to clear config: Permission denied');
    });
  });

  describe('CONSTANTS', () => {
    it('should export CONFIG_DIR', () => {
      expect(CONFIG_DIR).toBe(path.join(os.homedir(), '.aifabrix'));
    });

    it('should export CONFIG_FILE', () => {
      expect(CONFIG_FILE).toBe(path.join(CONFIG_DIR, 'config.yaml'));
    });
  });
});

