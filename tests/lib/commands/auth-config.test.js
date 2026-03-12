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
  getControllerUrl
} = require('../../../lib/core/config');
const {
  validateControllerUrl,
  validateEnvironment,
  checkUserLoggedIn
} = require('../../../lib/utils/auth-config-validator');
const { getControllerUrlFromLoggedInUser } = require('../../../lib/utils/controller-url');
const logger = require('../../../lib/utils/logger');

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/auth-config-validator');
jest.mock('../../../lib/utils/controller-url');
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn()
}));

describe('Auth Config Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
