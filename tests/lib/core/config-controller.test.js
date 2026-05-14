/**
 * Tests for Config Controller URL Functions
 *
 * @fileoverview Tests for controller URL storage in config.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const yaml = require('js-yaml');

// Mock token-encryption module before requiring config
jest.mock('../../../lib/utils/token-encryption', () => ({
  isTokenEncrypted: jest.fn(),
  encryptToken: jest.fn(),
  decryptToken: jest.fn()
}));

// Mock config-tokens and config-paths modules
jest.mock('../../../lib/utils/config-tokens', () => ({
  createTokenManagementFunctions: jest.fn(() => ({}))
}));

jest.mock('../../../lib/utils/config-paths', () => ({
  createPathConfigFunctions: jest.fn(() => ({}))
}));

const {
  setControllerUrl,
  getControllerUrl,
  getRegisteredControllerUrls
} = require('../../../lib/core/config');

// Spy on fs.promises methods
jest.spyOn(fs, 'readFile');
jest.spyOn(fs, 'writeFile');
jest.spyOn(fs, 'mkdir');
jest.spyOn(fs, 'open');
jest.spyOn(fs, 'unlink');

describe('Config Controller URL Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fully reset fs mock implementations to avoid pollution from other tests
    // (e.g. config.test.js) that share fs.promises when run in the same worker
    fs.readFile.mockReset();
    fs.writeFile.mockReset();
    fs.mkdir.mockReset();
    fs.open.mockReset();
    fs.unlink.mockReset();
    // Re-apply default implementations
    fs.readFile.mockRejectedValue({ code: 'ENOENT' }); // Default: file doesn't exist
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    const mockFd = { sync: jest.fn().mockResolvedValue(), close: jest.fn().mockResolvedValue() };
    fs.open.mockResolvedValue(mockFd);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setControllerUrl', () => {
    it('should save controller URL to config', async() => {
      const controllerUrl = 'https://controller.example.com';
      const mockConfig = { environment: 'dev', device: {} };

      fs.readFile.mockResolvedValueOnce(yaml.dump(mockConfig));
      fs.mkdir.mockResolvedValueOnce();
      fs.writeFile.mockResolvedValueOnce();
      const mockFd = { sync: jest.fn().mockResolvedValue(), close: jest.fn().mockResolvedValue() };
      fs.open.mockResolvedValueOnce(mockFd);

      await setControllerUrl(controllerUrl);

      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      const parsed = yaml.load(writtenContent);
      expect(parsed.controller).toBe('https://controller.example.com');
    });

    it('should normalize controller URL (remove trailing slashes)', async() => {
      const controllerUrl = 'https://controller.example.com/';
      const mockConfig = { environment: 'dev', device: {} };

      fs.readFile.mockResolvedValueOnce(yaml.dump(mockConfig));
      fs.mkdir.mockResolvedValueOnce();
      fs.writeFile.mockResolvedValueOnce();
      const mockFd = { sync: jest.fn().mockResolvedValue(), close: jest.fn().mockResolvedValue() };
      fs.open.mockResolvedValueOnce(mockFd);

      await setControllerUrl(controllerUrl);

      const writtenContent = fs.writeFile.mock.calls[0][1];
      const parsed = yaml.load(writtenContent);
      expect(parsed.controller).toBe('https://controller.example.com');
    });

    it('should throw error if controller URL is invalid', async() => {
      await expect(setControllerUrl('')).rejects.toThrow('Controller URL is required');
      await expect(setControllerUrl(null)).rejects.toThrow('Controller URL is required');
      await expect(setControllerUrl(undefined)).rejects.toThrow('Controller URL is required');
    });
  });

  describe('getControllerUrl', () => {
    it('should return controller URL from config', async() => {
      const mockConfig = {
        controller: 'https://controller.example.com',
        environment: 'dev',
        device: {}
      };

      fs.readFile.mockResolvedValueOnce(yaml.dump(mockConfig));

      const url = await getControllerUrl();

      expect(url).toBe('https://controller.example.com');
    });

    it('should return null if controller URL is not set', async() => {
      const mockConfig = { environment: 'dev', device: {} };

      fs.readFile.mockResolvedValueOnce(yaml.dump(mockConfig));

      const url = await getControllerUrl();

      expect(url).toBeNull();
    });
  });

  describe('getRegisteredControllerUrls', () => {
    it('should merge controller and device keys, dedupe, and sort', async() => {
      const mockConfig = {
        controller: 'https://b.example.com',
        environment: 'dev',
        device: {
          'https://a.example.com': { token: 'x' },
          'https://b.example.com/': { token: 'y' }
        }
      };
      fs.readFile.mockResolvedValueOnce(yaml.dump(mockConfig));

      const urls = await getRegisteredControllerUrls();

      expect(urls).toEqual(['https://a.example.com', 'https://b.example.com']);
    });

    it('should ignore non-http device keys', async() => {
      const mockConfig = {
        environment: 'dev',
        device: {
          'not-a-url': {},
          'https://only.example.com': {}
        }
      };
      fs.readFile.mockResolvedValueOnce(yaml.dump(mockConfig));

      const urls = await getRegisteredControllerUrls();

      expect(urls).toEqual(['https://only.example.com']);
    });

    it('should return empty array when no controller and no device URLs', async() => {
      const mockConfig = { environment: 'dev', device: {} };
      fs.readFile.mockResolvedValueOnce(yaml.dump(mockConfig));

      const urls = await getRegisteredControllerUrls();

      expect(urls).toEqual([]);
    });
  });
});
