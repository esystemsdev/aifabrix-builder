/**
 * Tests for Environment Port Utilities
 *
 * @fileoverview Unit tests for env-ports.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// Mock fs BEFORE requiring module
jest.mock('fs');

// Mock config module
jest.mock('../../../lib/config', () => ({
  CONFIG_FILE: '/mock/home/.aifabrix/config.yaml'
}));

const { updateContainerPortInEnvFile } = require('../../../lib/utils/env-ports');
const config = require('../../../lib/config');

describe('Environment Port Utilities', () => {
  const envPath = path.join(process.cwd(), 'builder', 'testapp', '.env');
  const variablesPath = path.join(process.cwd(), 'builder', 'testapp', 'variables.yaml');
  const configPath = config.CONFIG_FILE;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variable
    delete process.env.AIFABRIX_DEVELOPERID;
  });

  afterEach(() => {
    delete process.env.AIFABRIX_DEVELOPERID;
  });

  describe('updateContainerPortInEnvFile', () => {
    it('should return early when variablesPath does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      updateContainerPortInEnvFile(envPath, variablesPath);

      expect(fs.existsSync).toHaveBeenCalledWith(variablesPath);
      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should use default port 3000 when port not specified in variables.yaml', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'app:\n  name: Test App';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3000'), { mode: 0o600 });
    });

    it('should use port from variables.yaml when specified', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 4000\napp:\n  name: Test App';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=4000'), { mode: 0o600 });
    });

    it('should use developer-id from environment variable when set', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';

      process.env.AIFABRIX_DEVELOPERID = '2';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      // dev-id 2 => 3000 + 2*100 = 3200
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3200'), { mode: 0o600 });
    });

    it('should ignore invalid developer-id from environment variable', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';

      process.env.AIFABRIX_DEVELOPERID = 'invalid';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        if (filePath === configPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        if (filePath === configPath) return 'developer-id: 1';
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      // Should fallback to config file, dev-id 1 => 3000 + 1*100 = 3100
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3100'), { mode: 0o600 });
    });

    it('should read developer-id from config file when env var not set', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';
      const configContent = 'developer-id: 3';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        if (filePath === configPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        if (filePath === configPath) return configContent;
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      // dev-id 3 => 3000 + 3*100 = 3300
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3300'), { mode: 0o600 });
    });

    it('should parse developer-id as number from config file', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';
      const configContent = 'developer-id: 5';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        if (filePath === configPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        if (filePath === configPath) {
          // Simulate YAML parsing that returns number
          const parsed = yaml.load(configContent);
          return configContent;
        }
        return '';
      });

      // Mock yaml.load to return number
      jest.spyOn(yaml, 'load').mockImplementation((content) => {
        if (content === configContent) {
          return { 'developer-id': 5 };
        }
        if (content === variablesContent) {
          return { port: 3000 };
        }
        return {};
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      // dev-id 5 => 3000 + 5*100 = 3500
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3500'), { mode: 0o600 });

      yaml.load.mockRestore();
    });

    it('should parse developer-id as string from config file', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';
      const configContent = 'developer-id: "4"';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        if (filePath === configPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        if (filePath === configPath) return configContent;
        return '';
      });

      // Mock yaml.load to return string
      jest.spyOn(yaml, 'load').mockImplementation((content) => {
        if (content === configContent) {
          return { 'developer-id': '4' };
        }
        if (content === variablesContent) {
          return { port: 3000 };
        }
        return {};
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      // dev-id 4 => 3000 + 4*100 = 3400
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3400'), { mode: 0o600 });

      yaml.load.mockRestore();
    });

    it('should ignore invalid developer-id string from config file', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';
      const configContent = 'developer-id: "invalid"';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        if (filePath === configPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        if (filePath === configPath) return configContent;
        return '';
      });

      // Mock yaml.load to return invalid string
      jest.spyOn(yaml, 'load').mockImplementation((content) => {
        if (content === configContent) {
          return { 'developer-id': 'invalid' };
        }
        if (content === variablesContent) {
          return { port: 3000 };
        }
        return {};
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      // Should use base port (3000) when developer-id is invalid
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3000'), { mode: 0o600 });

      yaml.load.mockRestore();
    });

    it('should use base port when developer-id is 0', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';

      process.env.AIFABRIX_DEVELOPERID = '0';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      // dev-id 0 => base port (3000)
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3000'), { mode: 0o600 });
    });

    it('should replace existing PORT in .env file', () => {
      const envContent = 'PORT=5000\nOTHER_VAR=value\nANOTHER_VAR=test';
      const variablesContent = 'port: 3000';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toMatch(/^PORT=3000$/m);
      expect(writtenContent).toContain('OTHER_VAR=value');
      expect(writtenContent).toContain('ANOTHER_VAR=test');
      expect(writtenContent).not.toContain('PORT=5000');
    });

    it('should handle error when config file read fails', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        if (filePath === configPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        if (filePath === configPath) {
          throw new Error('Permission denied');
        }
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      // Should not throw, should use default dev-id 0
      expect(() => {
        updateContainerPortInEnvFile(envPath, variablesPath);
      }).not.toThrow();

      // Should use base port when error occurs
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3000'), { mode: 0o600 });
    });

    it('should handle config file not existing', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        if (filePath === configPath) return false;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      // Should use base port when config file doesn't exist
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3000'), { mode: 0o600 });
    });

    it('should handle config.CONFIG_FILE being null', () => {
      const envContent = 'PORT=3000\nOTHER_VAR=value';
      const variablesContent = 'port: 3000';

      // Temporarily set CONFIG_FILE to null
      const originalConfigFile = config.CONFIG_FILE;
      config.CONFIG_FILE = null;

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return true;
        if (filePath === envPath) return true;
        return false;
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) return variablesContent;
        if (filePath === envPath) return envContent;
        return '';
      });

      fs.writeFileSync.mockImplementation(() => {});

      updateContainerPortInEnvFile(envPath, variablesPath);

      // Should use base port when CONFIG_FILE is null
      expect(fs.writeFileSync).toHaveBeenCalledWith(envPath, expect.stringContaining('PORT=3000'), { mode: 0o600 });

      // Restore original value
      config.CONFIG_FILE = originalConfigFile;
    });
  });
});

