/**
 * Tests for logout command
 *
 * @fileoverview Tests for logout command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock dependencies BEFORE requiring any modules
jest.mock('os');
jest.mock('path');

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock config BEFORE requiring logout command
jest.mock('../../../lib/core/config', () => ({
  clearDeviceToken: jest.fn(),
  clearAllDeviceTokens: jest.fn(),
  clearClientToken: jest.fn(),
  clearAllClientTokens: jest.fn(),
  clearClientTokensForEnvironment: jest.fn(),
  normalizeControllerUrl: jest.fn((url) => {
    if (!url || typeof url !== 'string') return url;
    let normalized = url.trim().replace(/\/+$/, '');
    if (!normalized.match(/^https?:\/\//)) {
      normalized = `http://${normalized}`;
    }
    return normalized;
  })
}));

const os = require('os');
const path = require('path');
const { handleLogout } = require('../../../lib/commands/logout');
const config = require('../../../lib/core/config');
const logger = require('../../../lib/utils/logger');

describe('logout command', () => {
  const mockHomeDir = '/home/test';
  const mockConfigPath = '/home/test/.aifabrix/config.yaml';

  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables to prevent supports-color issues
    process.env.FORCE_COLOR = '0';
    process.env.NO_COLOR = '1';
    process.env.TERM = 'dumb';

    os.homedir.mockReturnValue(mockHomeDir);
    path.join.mockImplementation((...args) => args.join('/'));

    config.clearDeviceToken.mockResolvedValue(false);
    config.clearAllDeviceTokens.mockResolvedValue(0);
    config.clearClientToken.mockResolvedValue(false);
    config.clearAllClientTokens.mockResolvedValue(0);
    config.clearClientTokensForEnvironment.mockResolvedValue(0);
  });

  describe('handleLogout', () => {
    describe('validation', () => {
      it('should throw error if --app is provided without --environment', async() => {
        await expect(handleLogout({ app: 'myapp' })).rejects.toThrow('--app requires --environment option');
      });

      it('should throw error if controller URL is invalid', async() => {
        await expect(handleLogout({ controller: '' })).rejects.toThrow('Controller URL is required');
        await expect(handleLogout({ controller: 'invalid-url' })).rejects.toThrow('Controller URL must be a valid HTTP or HTTPS URL');
      });

      it('should throw error if environment key format is invalid', async() => {
        await expect(handleLogout({ environment: 'invalid env!' })).rejects.toThrow('Environment key must contain only letters, numbers, hyphens, and underscores');
      });

      it('should accept valid controller URLs', async() => {
        config.clearDeviceToken.mockResolvedValue(true);
        await handleLogout({ controller: 'http://localhost:3000' });
        expect(config.clearDeviceToken).toHaveBeenCalled();
      });

      it('should accept valid environment keys', async() => {
        config.clearClientTokensForEnvironment.mockResolvedValue(2);
        await handleLogout({ environment: 'dev' });
        expect(config.clearClientTokensForEnvironment).toHaveBeenCalledWith('dev');
      });
    });

    describe('clearing device tokens', () => {
      it('should clear device token for specific controller', async() => {
        config.clearDeviceToken.mockResolvedValue(true);

        await handleLogout({ controller: 'http://localhost:3000' });

        expect(config.clearDeviceToken).toHaveBeenCalledWith('http://localhost:3000');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Cleared device token for controller'));
        expect(config.clearAllDeviceTokens).not.toHaveBeenCalled();
      });

      it('should handle case when device token does not exist for controller', async() => {
        config.clearDeviceToken.mockResolvedValue(false);

        await handleLogout({ controller: 'http://localhost:3000' });

        expect(config.clearDeviceToken).toHaveBeenCalledWith('http://localhost:3000');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No device token found'));
      });

      it('should clear all device tokens when no options provided', async() => {
        config.clearAllDeviceTokens.mockResolvedValue(3);
        config.clearAllClientTokens.mockResolvedValue(0);

        await handleLogout({});

        expect(config.clearAllDeviceTokens).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Cleared 3 device token(s)'));
      });

      it('should handle case when no device tokens exist', async() => {
        config.clearAllDeviceTokens.mockResolvedValue(0);
        config.clearAllClientTokens.mockResolvedValue(0);

        await handleLogout({});

        expect(config.clearAllDeviceTokens).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No device tokens found'));
      });
    });

    describe('clearing client tokens', () => {
      it('should clear client token for specific app and environment', async() => {
        config.clearClientToken.mockResolvedValue(true);

        await handleLogout({ environment: 'dev', app: 'myapp' });

        expect(config.clearClientToken).toHaveBeenCalledWith('dev', 'myapp');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Cleared client token for app \'myapp\''));
        expect(config.clearClientTokensForEnvironment).not.toHaveBeenCalled();
        expect(config.clearAllClientTokens).not.toHaveBeenCalled();
      });

      it('should handle case when client token does not exist', async() => {
        config.clearClientToken.mockResolvedValue(false);

        await handleLogout({ environment: 'dev', app: 'myapp' });

        expect(config.clearClientToken).toHaveBeenCalledWith('dev', 'myapp');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No client token found'));
      });

      it('should clear all client tokens for environment', async() => {
        config.clearClientTokensForEnvironment.mockResolvedValue(2);

        await handleLogout({ environment: 'dev' });

        expect(config.clearClientTokensForEnvironment).toHaveBeenCalledWith('dev');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Cleared 2 client token(s)'));
        expect(config.clearClientToken).not.toHaveBeenCalled();
        expect(config.clearAllClientTokens).not.toHaveBeenCalled();
      });

      it('should handle case when no client tokens exist for environment', async() => {
        config.clearClientTokensForEnvironment.mockResolvedValue(0);

        await handleLogout({ environment: 'dev' });

        expect(config.clearClientTokensForEnvironment).toHaveBeenCalledWith('dev');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No client tokens found'));
      });

      it('should clear all client tokens when no options provided', async() => {
        config.clearAllDeviceTokens.mockResolvedValue(0);
        config.clearAllClientTokens.mockResolvedValue(5);

        await handleLogout({});

        expect(config.clearAllClientTokens).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Cleared 5 client token(s)'));
      });

      it('should handle case when no client tokens exist', async() => {
        config.clearAllDeviceTokens.mockResolvedValue(0);
        config.clearAllClientTokens.mockResolvedValue(0);

        await handleLogout({});

        expect(config.clearAllClientTokens).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No client tokens found'));
      });
    });

    describe('combined clearing', () => {
      it('should clear both device and client tokens when no options provided', async() => {
        config.clearAllDeviceTokens.mockResolvedValue(2);
        config.clearAllClientTokens.mockResolvedValue(3);

        await handleLogout({});

        expect(config.clearAllDeviceTokens).toHaveBeenCalled();
        expect(config.clearAllClientTokens).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Cleared 2 device token(s)'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Cleared 3 client token(s)'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Successfully cleared tokens!'));
      });

      it('should not clear device tokens when environment option is provided', async() => {
        config.clearClientTokensForEnvironment.mockResolvedValue(2);

        await handleLogout({ environment: 'dev' });

        expect(config.clearClientTokensForEnvironment).toHaveBeenCalled();
        expect(config.clearAllDeviceTokens).not.toHaveBeenCalled();
        expect(config.clearDeviceToken).not.toHaveBeenCalled();
      });

      it('should not clear client tokens when controller option is provided', async() => {
        config.clearDeviceToken.mockResolvedValue(true);

        await handleLogout({ controller: 'http://localhost:3000' });

        expect(config.clearDeviceToken).toHaveBeenCalled();
        expect(config.clearAllClientTokens).not.toHaveBeenCalled();
        expect(config.clearClientTokensForEnvironment).not.toHaveBeenCalled();
        expect(config.clearClientToken).not.toHaveBeenCalled();
      });
    });

    describe('success messages', () => {
      it('should show success message when tokens are cleared', async() => {
        config.clearAllDeviceTokens.mockResolvedValue(1);
        config.clearAllClientTokens.mockResolvedValue(2);

        await handleLogout({});

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Successfully cleared tokens!'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Config file:'));
      });

      it('should show warning when no tokens found', async() => {
        config.clearAllDeviceTokens.mockResolvedValue(0);
        config.clearAllClientTokens.mockResolvedValue(0);

        await handleLogout({});

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No tokens found to clear'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Config file:'));
      });
    });

    describe('edge cases', () => {
      it('should normalize controller URL before clearing', async() => {
        config.clearDeviceToken.mockResolvedValue(true);
        config.normalizeControllerUrl.mockImplementation((url) => {
          if (!url || typeof url !== 'string') return url;
          let normalized = url.trim().replace(/\/+$/, '');
          if (!normalized.match(/^https?:\/\//)) {
            normalized = `http://${normalized}`;
          }
          return normalized;
        });

        await handleLogout({ controller: 'localhost:3000' });

        expect(config.normalizeControllerUrl).toHaveBeenCalled();
        expect(config.clearDeviceToken).toHaveBeenCalled();
      });

      it('should handle HTTPS URLs', async() => {
        config.clearDeviceToken.mockResolvedValue(true);

        await handleLogout({ controller: 'https://controller.example.com' });

        expect(config.clearDeviceToken).toHaveBeenCalledWith('https://controller.example.com');
      });

      it('should handle URLs with trailing slashes', async() => {
        config.clearDeviceToken.mockResolvedValue(true);
        config.normalizeControllerUrl.mockReturnValue('http://localhost:3000');

        await handleLogout({ controller: 'http://localhost:3000/' });

        expect(config.normalizeControllerUrl).toHaveBeenCalled();
        expect(config.clearDeviceToken).toHaveBeenCalled();
      });

      it('should preserve other config settings when clearing tokens', async() => {
        config.clearAllDeviceTokens.mockResolvedValue(1);
        config.clearAllClientTokens.mockResolvedValue(1);

        await handleLogout({});

        // Verify that only token clearing functions were called
        expect(config.clearAllDeviceTokens).toHaveBeenCalled();
        expect(config.clearAllClientTokens).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should propagate errors from config functions', async() => {
        const error = new Error('Config save failed');
        config.clearAllDeviceTokens.mockRejectedValue(error);

        await expect(handleLogout({})).rejects.toThrow('Config save failed');
      });

      it('should handle errors gracefully when clearing device token', async() => {
        const error = new Error('Failed to clear device token');
        config.clearDeviceToken.mockRejectedValue(error);

        await expect(handleLogout({ controller: 'http://localhost:3000' })).rejects.toThrow('Failed to clear device token');
      });

      it('should handle errors gracefully when clearing client token', async() => {
        const error = new Error('Failed to clear client token');
        config.clearClientToken.mockRejectedValue(error);

        await expect(handleLogout({ environment: 'dev', app: 'myapp' })).rejects.toThrow('Failed to clear client token');
      });
    });
  });
});

