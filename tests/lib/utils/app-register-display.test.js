/**
 * Tests for App Register Display Module
 *
 * @fileoverview Unit tests for lib/utils/app-register-display.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  mockChalk.bold.yellow = jest.fn((text) => text);
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
const { displayRegistrationResults, getEnvironmentPrefix } = require('../../../lib/utils/app-register-display');

describe('App Register Display Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEnvironmentPrefix', () => {
    it('should return DEV for dev environment', () => {
      expect(getEnvironmentPrefix('dev')).toBe('DEV');
      expect(getEnvironmentPrefix('DEV')).toBe('DEV');
    });

    it('should return DEV for development environment', () => {
      expect(getEnvironmentPrefix('development')).toBe('DEV');
      expect(getEnvironmentPrefix('DEVELOPMENT')).toBe('DEV');
    });

    it('should return TST for test environment', () => {
      expect(getEnvironmentPrefix('tst')).toBe('TST');
      expect(getEnvironmentPrefix('test')).toBe('TST');
      expect(getEnvironmentPrefix('staging')).toBe('TST');
    });

    it('should return PRO for production environment', () => {
      expect(getEnvironmentPrefix('pro')).toBe('PRO');
      expect(getEnvironmentPrefix('prod')).toBe('PRO');
      expect(getEnvironmentPrefix('production')).toBe('PRO');
    });

    it('should return uppercase for miso environment', () => {
      expect(getEnvironmentPrefix('miso')).toBe('MISO');
      expect(getEnvironmentPrefix('MISO')).toBe('MISO');
    });

    it('should return first 4 characters for long environment names', () => {
      expect(getEnvironmentPrefix('custom-env')).toBe('CUST');
      expect(getEnvironmentPrefix('very-long-environment-name')).toBe('VERY');
    });

    it('should return full uppercase for short custom environments', () => {
      expect(getEnvironmentPrefix('qa')).toBe('QA');
      expect(getEnvironmentPrefix('stg')).toBe('STG');
      expect(getEnvironmentPrefix('demo')).toBe('DEMO');
    });

    it('should return DEV as default for null/undefined', () => {
      expect(getEnvironmentPrefix(null)).toBe('DEV');
      expect(getEnvironmentPrefix(undefined)).toBe('DEV');
      expect(getEnvironmentPrefix('')).toBe('DEV');
    });
  });

  describe('displayRegistrationResults', () => {
    it('should display registration results with all information', () => {
      const data = {
        application: {
          id: 'app-123',
          key: 'myapp',
          displayName: 'My Application'
        },
        credentials: {
          clientId: 'client-id-123',
          clientSecret: 'client-secret-456'
        }
      };
      const apiUrl = 'http://localhost:3000';
      const environment = 'dev';

      displayRegistrationResults(data, apiUrl, environment);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✅ Application registered successfully!'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('📋 Application Details:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('ID:           app-123'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Key:          myapp'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Display Name: My Application'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('🔑 CREDENTIALS'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Client ID:     client-id-123'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Client Secret: client-secret-456'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('⚠️  IMPORTANT: Client Secret will not be shown again!'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('📝 Add to GitHub Secrets:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('MISO_CONTROLLER_URL = http://localhost:3000'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('DEV_MISO_CLIENTID = client-id-123'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('DEV_MISO_CLIENTSECRET = client-secret-456'));
    });

    it('should use correct environment prefix for test environment', () => {
      const data = {
        application: {
          id: 'app-123',
          key: 'myapp',
          displayName: 'My Application'
        },
        credentials: {
          clientId: 'client-id-123',
          clientSecret: 'client-secret-456'
        }
      };
      const apiUrl = 'http://localhost:3000';
      const environment = 'test';

      displayRegistrationResults(data, apiUrl, environment);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('TST_MISO_CLIENTID = client-id-123'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('TST_MISO_CLIENTSECRET = client-secret-456'));
    });

    it('should use correct environment prefix for production environment', () => {
      const data = {
        application: {
          id: 'app-123',
          key: 'myapp',
          displayName: 'My Application'
        },
        credentials: {
          clientId: 'client-id-123',
          clientSecret: 'client-secret-456'
        }
      };
      const apiUrl = 'http://localhost:3000';
      const environment = 'production';

      displayRegistrationResults(data, apiUrl, environment);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('PRO_MISO_CLIENTID = client-id-123'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('PRO_MISO_CLIENTSECRET = client-secret-456'));
    });

    it('should use correct environment prefix for custom environment', () => {
      const data = {
        application: {
          id: 'app-123',
          key: 'myapp',
          displayName: 'My Application'
        },
        credentials: {
          clientId: 'client-id-123',
          clientSecret: 'client-secret-456'
        }
      };
      const apiUrl = 'http://localhost:3000';
      const environment = 'miso';

      displayRegistrationResults(data, apiUrl, environment);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('MISO_MISO_CLIENTID = client-id-123'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('MISO_MISO_CLIENTSECRET = client-secret-456'));
    });

    it('should display environment level section with environment name', () => {
      const data = {
        application: {
          id: 'app-123',
          key: 'myapp',
          displayName: 'My Application'
        },
        credentials: {
          clientId: 'client-id-123',
          clientSecret: 'client-secret-456'
        }
      };
      const apiUrl = 'http://localhost:3000';
      const environment = 'custom-env';

      displayRegistrationResults(data, apiUrl, environment);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Environment level (custom-env):'));
    });
  });
});

