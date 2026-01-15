/**
 * Tests for Environment Template Module
 *
 * @fileoverview Unit tests for lib/utils/env-template.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('../../../lib/utils/logger');
const { updateEnvTemplate } = require('../../../lib/utils/env-template');

// Mock fsSync.existsSync and fs.promises.readFile
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    promises: {
      ...actualFs.promises,
      readFile: jest.fn(),
      writeFile: jest.fn()
    }
  };
});

describe('Environment Template Module', () => {
  const testAppKey = 'test-app';
  const testClientIdKey = 'test-app-client-idKeyVault';
  const testClientSecretKey = 'test-app-client-secretKeyVault';
  const testControllerUrl = 'https://controller.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateEnvTemplate', () => {
    it('should warn if env.template does not exist', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      jest.spyOn(fsSync, 'existsSync').mockReturnValue(false);

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, testControllerUrl);

      expect(fsSync.existsSync).toHaveBeenCalledWith(envTemplatePath);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('env.template not found'));
      expect(fs.readFile).not.toHaveBeenCalled();

      fsSync.existsSync.mockRestore();
    });

    it('should add all MISO entries when none exist', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      const initialContent = '# Database Configuration\nDATABASE_URL=postgres://localhost:5432/mydb\n';
      jest.spyOn(fsSync, 'existsSync').mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, testControllerUrl);

      expect(fs.readFile).toHaveBeenCalledWith(envTemplatePath, 'utf8');
      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('MISO_CLIENTID=kv://test-app-client-idKeyVault');
      expect(writtenContent).toContain('MISO_CLIENTSECRET=kv://test-app-client-secretKeyVault');
      expect(writtenContent).toContain('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
      expect(writtenContent).toContain('# MISO Application Client Credentials (per application)');

      fsSync.existsSync.mockRestore();
    });

    it('should update existing MISO entries', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      const initialContent = `# MISO Configuration
MISO_CLIENTID=kv://old-client-id
MISO_CLIENTSECRET=kv://old-client-secret
MISO_CONTROLLER_URL=http://old-controller:3010
`;
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, testControllerUrl);

      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('MISO_CLIENTID=kv://test-app-client-idKeyVault');
      expect(writtenContent).toContain('MISO_CLIENTSECRET=kv://test-app-client-secretKeyVault');
      expect(writtenContent).toContain('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
      expect(writtenContent).not.toContain('kv://old-client-id');
      expect(writtenContent).not.toContain('kv://old-client-secret');
      expect(writtenContent).not.toContain('http://old-controller:3010');

      fsSync.existsSync.mockRestore();
    });

    it('should add missing entries when some exist', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      const initialContent = `# MISO Configuration
MISO_CLIENTID=kv://old-client-id
# Missing MISO_CLIENTSECRET and MISO_CONTROLLER_URL
`;
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, testControllerUrl);

      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('MISO_CLIENTID=kv://test-app-client-idKeyVault');
      expect(writtenContent).toContain('MISO_CLIENTSECRET=kv://test-app-client-secretKeyVault');
      expect(writtenContent).toContain('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');

      fsSync.existsSync.mockRestore();
    });

    it('should insert MISO section after last section marker', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      const initialContent = `# Database Configuration
DATABASE_URL=postgres://localhost:5432/mydb
# ============================================
# Redis Configuration
REDIS_URL=redis://localhost:6379
`;
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, testControllerUrl);

      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      const misoSectionIndex = writtenContent.indexOf('# MISO Application Client Credentials');
      const lastSectionIndex = writtenContent.lastIndexOf('# ============================================');
      expect(misoSectionIndex).toBeGreaterThan(lastSectionIndex);

      fsSync.existsSync.mockRestore();
    });

    it('should append MISO section when no section markers exist', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      const initialContent = 'DATABASE_URL=postgres://localhost:5432/mydb\n';
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, testControllerUrl);

      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('DATABASE_URL=postgres://localhost:5432/mydb');
      expect(writtenContent).toContain('# MISO Application Client Credentials');
      expect(writtenContent.endsWith('\n')).toBe(true);

      fsSync.existsSync.mockRestore();
    });

    it('should handle file read errors gracefully', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockRejectedValue(new Error('Permission denied'));

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, testControllerUrl);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not update env.template'));
      expect(fs.writeFile).not.toHaveBeenCalled();

      fsSync.existsSync.mockRestore();
    });

    it('should handle file write errors gracefully', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      const initialContent = '# Database Configuration\nDATABASE_URL=postgres://localhost:5432/mydb\n';
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Disk full'));

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, testControllerUrl);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not update env.template'));

      fsSync.existsSync.mockRestore();
    });

    it('should handle entries with different whitespace', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      const initialContent = `MISO_CLIENTID = kv://old-id
MISO_CLIENTSECRET=kv://old-secret
MISO_CONTROLLER_URL = http://old:3010
`;
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, testControllerUrl);

      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('MISO_CLIENTID=kv://test-app-client-idKeyVault');
      expect(writtenContent).toContain('MISO_CLIENTSECRET=kv://test-app-client-secretKeyVault');
      expect(writtenContent).toContain('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');

      fsSync.existsSync.mockRestore();
    });

    it('should ignore controllerUrl parameter and use template format', async() => {
      const envTemplatePath = path.join(process.cwd(), 'builder', testAppKey, 'env.template');
      const initialContent = '# Configuration\n';
      fsSync.existsSync = jest.fn().mockReturnValue(true);
      fs.readFile = jest.fn().mockResolvedValue(initialContent);
      fs.writeFile = jest.fn().mockResolvedValue();

      await updateEnvTemplate(testAppKey, testClientIdKey, testClientSecretKey, 'https://custom-controller.com');

      expect(fs.writeFile).toHaveBeenCalled();
      const writtenContent = fs.writeFile.mock.calls[0][1];
      // Should use template format, not the provided controllerUrl
      expect(writtenContent).toContain('MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}');
      expect(writtenContent).not.toContain('https://custom-controller.com');

      fsSync.existsSync.mockRestore();
    });
  });
});

