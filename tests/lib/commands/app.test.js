/**
 * Tests for AI Fabrix Builder App Commands Module
 *
 * @fileoverview Unit tests for commands/app.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Mock chalk before requiring modules that use it
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  return mockChalk;
});

// Note: We don't mock secrets/config/api modules here since updateEnvTemplate doesn't use them

// Mock logger - use same pattern as secrets.test.js
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock fs
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn()
    },
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn()
  };
});

const logger = require('../../../lib/utils/logger');
const { updateEnvTemplate } = require('../../../lib/utils/env-template');

describe('App Commands Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateEnvTemplate', () => {
    const appKey = 'myapp';
    const clientIdKey = 'myapp-client-idKeyVault';
    const clientSecretKey = 'myapp-client-secretKeyVault';
    const controllerUrl = 'http://localhost:3010';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should add MISO_CLIENTID, MISO_CLIENTSECRET, and MISO_CONTROLLER_URL to env.template when not present', async() => {
      const existingContent = '# Application Environment\nPORT=3000\n';
      const envTemplatePath = path.join(process.cwd(), 'builder', appKey, 'env.template');
      fsSync.existsSync.mockReturnValue(true);
      fs.readFile.mockResolvedValue(existingContent);
      fs.writeFile.mockResolvedValue();

      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, controllerUrl);

      expect(fs.readFile).toHaveBeenCalledWith(envTemplatePath, 'utf8');
      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('MISO_CLIENTID=kv://myapp-client-idKeyVault');
      expect(writtenContent).toContain('MISO_CLIENTSECRET=kv://myapp-client-secretKeyVault');
      expect(writtenContent).toContain('MISO_CONTROLLER_URL=http://localhost:3010');
    });

    it('should update existing MISO_CLIENTID, MISO_CLIENTSECRET, and MISO_CONTROLLER_URL', async() => {
      const existingContent = '# Application Environment\nPORT=3000\nMISO_CLIENTID=kv://old-key\nMISO_CLIENTSECRET=kv://old-secret\nMISO_CONTROLLER_URL=http://old-url\n';
      fsSync.existsSync.mockReturnValue(true);
      fs.readFile.mockResolvedValue(existingContent);
      fs.writeFile.mockResolvedValue();

      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, controllerUrl);

      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('MISO_CLIENTID=kv://myapp-client-idKeyVault');
      expect(writtenContent).toContain('MISO_CLIENTSECRET=kv://myapp-client-secretKeyVault');
      expect(writtenContent).toContain('MISO_CONTROLLER_URL=http://localhost:3010');
      expect(writtenContent).not.toContain('kv://old-key');
      expect(writtenContent).not.toContain('kv://old-secret');
      expect(writtenContent).not.toContain('http://old-url');
    });

    it('should warn if env.template not found', async() => {
      fsSync.existsSync.mockReturnValue(false);

      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, controllerUrl);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('env.template not found'));
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async() => {
      fsSync.existsSync.mockReturnValue(true);
      fs.readFile.mockRejectedValue(new Error('Read error'));

      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, controllerUrl);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not update env.template'));
    });
  });

});

