/**
 * Tests for Auth Config Commands
 *
 * @fileoverview Tests for auth-config.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { handleAuthConfig } = require('../../../lib/commands/auth-config');
const {
  setControllerUrl,
  setCurrentEnvironment,
  getControllerUrl,
  getRegisteredControllerUrls
} = require('../../../lib/core/config');
const {
  validateControllerUrl,
  validateEnvironment,
  checkUserLoggedIn
} = require('../../../lib/utils/auth-config-validator');
const { getControllerUrlFromLoggedInUser } = require('../../../lib/utils/controller-url');
const logger = require('../../../lib/utils/logger');

jest.mock('../../../lib/core/config', () => ({
  setControllerUrl: jest.fn(),
  setCurrentEnvironment: jest.fn(),
  getControllerUrl: jest.fn(),
  getRegisteredControllerUrls: jest.fn()
}));
jest.mock('../../../lib/utils/auth-config-validator');
jest.mock('../../../lib/utils/controller-url');
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

describe('Auth Config Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRegisteredControllerUrls.mockReset();
  });

  describe('handleAuthConfig --set-controller', () => {
    it('should set controller URL when logged in to that controller', async() => {
      validateControllerUrl.mockReturnValue(undefined);
      getControllerUrlFromLoggedInUser.mockResolvedValue('https://controller.example.com');
      setControllerUrl.mockResolvedValue();

      await handleAuthConfig({ setController: 'https://controller.example.com' });

      expect(validateControllerUrl).toHaveBeenCalledWith('https://controller.example.com');
      expect(getControllerUrlFromLoggedInUser).toHaveBeenCalled();
      expect(setControllerUrl).toHaveBeenCalledWith('https://controller.example.com');
      expect(logger.log).toHaveBeenCalled();
    });

    it('should set controller URL when no credentials stored (logged out)', async() => {
      validateControllerUrl.mockReturnValue(undefined);
      getControllerUrlFromLoggedInUser.mockResolvedValue(null);
      setControllerUrl.mockResolvedValue();

      await handleAuthConfig({ setController: 'http://localhost:3100' });

      expect(setControllerUrl).toHaveBeenCalledWith('http://localhost:3100');
      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw error if URL validation fails', async() => {
      validateControllerUrl.mockImplementation(() => {
        throw new Error('Invalid URL');
      });

      await expect(handleAuthConfig({ setController: 'invalid-url' }))
        .rejects.toThrow('Invalid URL');
      expect(setControllerUrl).not.toHaveBeenCalled();
    });

    it('should throw error when credentials exist for another controller', async() => {
      validateControllerUrl.mockReturnValue(undefined);
      getControllerUrlFromLoggedInUser.mockResolvedValue('https://other-controller.example.com');

      await expect(handleAuthConfig({ setController: 'https://controller.example.com' }))
        .rejects.toThrow('You have credentials for another controller');
      expect(setControllerUrl).not.toHaveBeenCalled();
    });
  });

  describe('handleAuthConfig --set-controller pick from config', () => {
    let prevIsTTY;

    beforeEach(() => {
      prevIsTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
    });

    afterEach(() => {
      process.stdin.isTTY = prevIsTTY;
    });

    it('should fail when no controllers are registered', async() => {
      getRegisteredControllerUrls.mockResolvedValue([]);

      await expect(handleAuthConfig({ setController: true }))
        .rejects.toThrow('No controllers are registered');
      expect(setControllerUrl).not.toHaveBeenCalled();
    });

    it('should fail in non-interactive mode when URL omitted', async() => {
      getRegisteredControllerUrls.mockResolvedValue(['http://localhost:3000']);
      const prev = process.stdin.isTTY;
      process.stdin.isTTY = false;
      try {
        await expect(handleAuthConfig({ setController: true }))
          .rejects.toThrow('non-interactive');
      } finally {
        process.stdin.isTTY = prev;
      }
      expect(setControllerUrl).not.toHaveBeenCalled();
    });

    it('should log only when single registered controller matches default', async() => {
      getRegisteredControllerUrls.mockResolvedValue(['http://localhost:3100']);
      getControllerUrl.mockResolvedValue('http://localhost:3100');

      await handleAuthConfig({ setController: true });

      expect(setControllerUrl).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalled();
    });

    it('should set controller when single registered differs from default', async() => {
      getRegisteredControllerUrls.mockResolvedValue(['http://localhost:3200']);
      getControllerUrl.mockResolvedValue('http://localhost:3100');
      validateControllerUrl.mockReturnValue(undefined);
      getControllerUrlFromLoggedInUser.mockResolvedValue(null);
      setControllerUrl.mockResolvedValue();

      await handleAuthConfig({ setController: true });

      expect(setControllerUrl).toHaveBeenCalledWith('http://localhost:3200');
    });

    it('should prompt and set when multiple controllers registered', async() => {
      const inquirer = require('inquirer');
      getRegisteredControllerUrls.mockResolvedValue([
        'http://localhost:3000',
        'http://localhost:3100'
      ]);
      inquirer.prompt.mockResolvedValue({ controllerUrl: 'http://localhost:3100' });
      validateControllerUrl.mockReturnValue(undefined);
      getControllerUrlFromLoggedInUser.mockResolvedValue(null);
      setControllerUrl.mockResolvedValue();

      await handleAuthConfig({ setController: true });

      expect(inquirer.prompt).toHaveBeenCalled();
      expect(setControllerUrl).toHaveBeenCalledWith('http://localhost:3100');
    });
  });

  describe('handleAuthConfig --set-environment', () => {
    it('should set environment successfully', async() => {
      validateEnvironment.mockReturnValue(undefined);
      getControllerUrl.mockResolvedValue('https://controller.example.com');
      checkUserLoggedIn.mockResolvedValue(true);
      setCurrentEnvironment.mockResolvedValue();

      await handleAuthConfig({ setEnvironment: 'dev' });

      expect(validateEnvironment).toHaveBeenCalledWith('dev');
      expect(getControllerUrl).toHaveBeenCalled();
      expect(checkUserLoggedIn).toHaveBeenCalledWith('https://controller.example.com');
      expect(setCurrentEnvironment).toHaveBeenCalledWith('dev');
      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw error if no controller URL in config', async() => {
      validateEnvironment.mockReturnValue(undefined);
      getControllerUrl.mockResolvedValue(null);

      await expect(handleAuthConfig({ setEnvironment: 'dev' }))
        .rejects.toThrow('No controller URL found');
      expect(setCurrentEnvironment).not.toHaveBeenCalled();
    });

    it('should throw error if environment validation fails', async() => {
      validateEnvironment.mockImplementation(() => {
        throw new Error('Invalid environment');
      });

      await expect(handleAuthConfig({ setEnvironment: 'invalid@env' }))
        .rejects.toThrow('Invalid environment');
    });
  });

  describe('handleAuthConfig - both --set-controller and --set-environment', () => {
    it('should set both controller and environment when both options provided', async() => {
      validateControllerUrl.mockReturnValue(undefined);
      getControllerUrlFromLoggedInUser.mockResolvedValue('https://controller.example.com');
      setControllerUrl.mockResolvedValue();
      getControllerUrl.mockResolvedValue('https://controller.example.com');
      validateEnvironment.mockReturnValue(undefined);
      checkUserLoggedIn.mockResolvedValue(true);
      setCurrentEnvironment.mockResolvedValue();

      await handleAuthConfig({
        setController: 'https://controller.example.com',
        setEnvironment: 'dev'
      });

      expect(validateControllerUrl).toHaveBeenCalledWith('https://controller.example.com');
      expect(getControllerUrlFromLoggedInUser).toHaveBeenCalled();
      expect(setControllerUrl).toHaveBeenCalledWith('https://controller.example.com');
      expect(validateEnvironment).toHaveBeenCalledWith('dev');
      expect(setCurrentEnvironment).toHaveBeenCalledWith('dev');
      expect(logger.log).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleAuthConfig - no action', () => {
    it('should throw error if no action specified', async() => {
      await expect(handleAuthConfig({}))
        .rejects.toThrow('No action specified');
    });
  });
});
