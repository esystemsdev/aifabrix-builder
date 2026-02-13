/**
 * Tests for Application Display Module
 *
 * @fileoverview Unit tests for lib/app/display.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk before requiring modules that use it
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.white = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  return mockChalk;
});

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { displaySuccessMessage, displayExternalSystemSuccess, displayWebappSuccess } = require('../../../lib/app/display');

describe('Application Display Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('displayExternalSystemSuccess', () => {
    it('should display external system success message', () => {
      const appName = 'test-system';
      const config = { systemKey: 'test-system' };
      const location = 'integration/test-system';

      displayExternalSystemSuccess(appName, config, location);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Type: External System'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('System Key: test-system'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Next steps:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('1. Edit external system JSON files'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('2. Run: aifabrix validate'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('2. Run: aifabrix validate'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('3. Run: aifabrix login'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('4. Run: aifabrix deploy'));
      expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('aifabrix build'));
    });

    it('should use appName when systemKey is not provided', () => {
      const appName = 'test-system';
      const config = {};
      const location = 'integration/test-system';

      displayExternalSystemSuccess(appName, config, location);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('System Key: test-system'));
    });
  });

  describe('displayWebappSuccess', () => {
    it('should display webapp success message with all features', () => {
      const appName = 'test-app';
      const config = {
        language: 'typescript',
        port: 3000,
        database: true,
        redis: true,
        storage: true,
        authentication: true
      };
      const envConversionMessage = 'Environment converted';

      displayWebappSuccess(appName, config, envConversionMessage);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Language: typescript'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Port: 3000'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Database enabled'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Redis enabled'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Storage enabled'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Authentication enabled'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Environment converted'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Next steps:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('aifabrix up-infra'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('aifabrix build'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('aifabrix run'));
    });

    it('should display webapp success message without optional features', () => {
      const appName = 'test-app';
      const config = {
        language: 'python',
        port: 8080
      };
      const envConversionMessage = '';

      displayWebappSuccess(appName, config, envConversionMessage);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Language: python'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Port: 8080'));
      expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Database enabled'));
      expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Redis enabled'));
    });
  });

  describe('displaySuccessMessage', () => {
    it('should display success message for external system', () => {
      const appName = 'test-system';
      const config = {
        type: 'external',
        systemKey: 'test-system'
      };
      const envConversionMessage = '';
      const hasAppFiles = false;
      const appPath = '/path/to/integration/test-system';

      displaySuccessMessage(appName, config, envConversionMessage, hasAppFiles, appPath);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application created successfully'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application: test-system'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Location:'));
    });

    it('should display success message for webapp', () => {
      const appName = 'test-app';
      const config = {
        type: 'webapp',
        language: 'typescript',
        port: 3000
      };
      const envConversionMessage = 'Environment converted';
      const hasAppFiles = false;

      displaySuccessMessage(appName, config, envConversionMessage, hasAppFiles);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application created successfully'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application: test-app'));
    });

    it('should display app files location when hasAppFiles is true', () => {
      const appName = 'test-app';
      const config = {
        type: 'webapp',
        language: 'typescript',
        port: 3000
      };
      const envConversionMessage = '';
      const hasAppFiles = true;

      displaySuccessMessage(appName, config, envConversionMessage, hasAppFiles);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application files: apps/test-app/'));
    });

    it('should use default location when appPath is not provided', () => {
      const appName = 'test-app';
      const config = {
        type: 'webapp',
        language: 'typescript',
        port: 3000
      };
      const envConversionMessage = '';
      const hasAppFiles = false;

      displaySuccessMessage(appName, config, envConversionMessage, hasAppFiles);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Location: builder/test-app/'));
    });

    it('should use integration directory for external type', () => {
      const appName = 'test-system';
      const config = {
        type: 'external',
        systemKey: 'test-system'
      };
      const envConversionMessage = '';
      const hasAppFiles = false;

      displaySuccessMessage(appName, config, envConversionMessage, hasAppFiles);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Location: integration/test-system/'));
    });
  });
});
