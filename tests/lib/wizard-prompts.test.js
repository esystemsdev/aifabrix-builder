/**
 * Tests for Wizard Prompts
 *
 * @fileoverview Tests for lib/wizard-prompts.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      access: jest.fn(),
      stat: jest.fn()
    }
  };
});

const inquirer = require('inquirer');
const fsPromises = require('fs').promises;
const path = require('path');
const wizardPrompts = require('../../lib/wizard-prompts');

describe('Wizard Prompts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('promptForMode', () => {
    it('should prompt for wizard mode', async() => {
      inquirer.prompt.mockResolvedValue({ mode: 'create-system' });
      const result = await wizardPrompts.promptForMode();
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(result).toBe('create-system');
    });

    it('should return add-datasource mode', async() => {
      inquirer.prompt.mockResolvedValue({ mode: 'add-datasource' });
      const result = await wizardPrompts.promptForMode();
      expect(result).toBe('add-datasource');
    });
  });

  describe('promptForSourceType', () => {
    it('should prompt for source type', async() => {
      inquirer.prompt.mockResolvedValue({ sourceType: 'openapi-file' });
      const result = await wizardPrompts.promptForSourceType();
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(result).toBe('openapi-file');
    });
  });

  describe('promptForOpenApiFile', () => {
    it('should prompt for OpenAPI file path', async() => {
      const filePath = '/path/to/openapi.yaml';
      fsPromises.stat.mockResolvedValue({ isFile: () => true });
      inquirer.prompt.mockResolvedValue({ filePath });
      const result = await wizardPrompts.promptForOpenApiFile();
      expect(result).toBe(path.resolve(filePath));
    });
  });

  describe('promptForOpenApiUrl', () => {
    it('should prompt for OpenAPI URL', async() => {
      const url = 'https://api.example.com/openapi.yaml';
      inquirer.prompt.mockResolvedValue({ url });
      const result = await wizardPrompts.promptForOpenApiUrl();
      expect(result).toBe(url);
    });
  });

  describe('promptForMcpServer', () => {
    it('should prompt for MCP server details', async() => {
      const serverUrl = 'https://mcp.example.com';
      const token = 'mcp-token-123';
      inquirer.prompt.mockResolvedValue({ serverUrl, token });
      const result = await wizardPrompts.promptForMcpServer();
      expect(result).toEqual({ serverUrl, token });
    });
  });

  describe('promptForKnownPlatform', () => {
    it('should prompt for known platform', async() => {
      inquirer.prompt.mockResolvedValue({ platform: 'hubspot' });
      const result = await wizardPrompts.promptForKnownPlatform();
      expect(result).toBe('hubspot');
    });

    it('should prompt with custom platforms', async() => {
      const platforms = [
        { key: 'custom1', displayName: 'Custom Platform 1' },
        { key: 'custom2', displayName: 'Custom Platform 2' }
      ];
      inquirer.prompt.mockResolvedValue({ platform: 'custom1' });
      const result = await wizardPrompts.promptForKnownPlatform(platforms);
      expect(result).toBe('custom1');
    });
  });

  describe('promptForUserIntent', () => {
    it('should prompt for user intent', async() => {
      inquirer.prompt.mockResolvedValue({ intent: 'sales-focused' });
      const result = await wizardPrompts.promptForUserIntent();
      expect(result).toBe('sales-focused');
    });
  });

  describe('promptForUserPreferences', () => {
    it('should prompt for user preferences', async() => {
      const preferences = { mcp: true, abac: false, rbac: true };
      inquirer.prompt.mockResolvedValue(preferences);
      const result = await wizardPrompts.promptForUserPreferences();
      expect(result).toEqual(preferences);
    });
  });

  describe('promptForConfigReview', () => {
    it('should prompt for config review with accept', async() => {
      const systemConfig = { key: 'test-system' };
      const datasourceConfigs = [{ key: 'ds1' }];
      inquirer.prompt.mockResolvedValue({ action: 'accept' });
      const result = await wizardPrompts.promptForConfigReview(systemConfig, datasourceConfigs);
      expect(result.action).toBe('accept');
    });

    it('should prompt for config review with edit', async() => {
      const systemConfig = { key: 'test-system' };
      const datasourceConfigs = [{ key: 'ds1' }];
      const editedConfig = JSON.stringify({
        systemConfig: { key: 'edited-system' },
        datasourceConfigs: [{ key: 'edited-ds1' }]
      });
      inquirer.prompt.mockResolvedValue({ action: 'edit', editedConfig });
      const result = await wizardPrompts.promptForConfigReview(systemConfig, datasourceConfigs);
      expect(result.action).toBe('edit');
      expect(result.systemConfig).toBeDefined();
      expect(result.datasourceConfigs).toBeDefined();
    });
  });

  describe('promptForAppName', () => {
    it('should prompt for application name', async() => {
      inquirer.prompt.mockResolvedValue({ appName: 'test-app' });
      const result = await wizardPrompts.promptForAppName();
      expect(result).toBe('test-app');
    });

    it('should use default name if provided', async() => {
      inquirer.prompt.mockResolvedValue({ appName: 'default-app' });
      const result = await wizardPrompts.promptForAppName('default-app');
      expect(result).toBe('default-app');
    });
  });
});
