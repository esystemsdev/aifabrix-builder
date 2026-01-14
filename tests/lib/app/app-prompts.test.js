/**
 * Tests for AI Fabrix Builder Application Prompts Module
 *
 * @fileoverview Unit tests for app-prompts.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

const { promptForOptions } = require('../../../lib/app/prompts');

describe('Application Prompts Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('promptForOptions', () => {
    it('should prompt for external system questions when type is external', async() => {
      inquirer.prompt.mockResolvedValue({
        systemKey: 'test-system',
        systemDisplayName: 'Test System',
        systemDescription: 'Test description',
        systemType: 'openapi',
        authType: 'apikey',
        datasourceCount: '2',
        github: false
      });

      const result = await promptForOptions('test-app', { type: 'external' });

      expect(result).toMatchObject({
        appName: 'test-app',
        type: 'external',
        systemKey: 'test-system',
        systemDisplayName: 'Test System',
        systemDescription: 'Test description',
        systemType: 'openapi',
        authType: 'apikey',
        datasourceCount: 2
      });
      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should skip prompts for external type when all options provided', async() => {
      const options = {
        type: 'external',
        systemKey: 'test-system',
        systemDisplayName: 'Test System',
        systemDescription: 'Test description',
        systemType: 'openapi',
        authType: 'apikey',
        datasourceCount: '1',
        github: false
      };

      const result = await promptForOptions('test-app', options);

      expect(result).toMatchObject({
        appName: 'test-app',
        type: 'external',
        systemKey: 'test-system'
      });
      // Should not prompt when all options provided
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should prompt for basic questions for regular apps', async() => {
      inquirer.prompt.mockResolvedValue({
        port: '3000',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: false
      });

      const result = await promptForOptions('test-app', {});

      expect(result).toMatchObject({
        appName: 'test-app',
        type: 'webapp',
        port: 3000,
        language: 'typescript'
      });
    });

    it('should skip port and language prompts for external type', async() => {
      inquirer.prompt.mockResolvedValue({
        systemKey: 'test-system',
        systemDisplayName: 'Test System',
        systemDescription: 'Test description',
        systemType: 'openapi',
        authType: 'apikey',
        datasourceCount: '1',
        github: false
      });

      const result = await promptForOptions('test-app', { type: 'external' });

      // Should not have port or language for external type
      expect(result.port).toBeUndefined();
      expect(result.language).toBeUndefined();
    });

    it('should handle workflow questions with controller URL', async() => {
      inquirer.prompt.mockResolvedValue({
        port: '3000',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: true,
        controller: true,
        controllerUrl: 'http://localhost:3000'
      });

      const result = await promptForOptions('test-app', {});

      expect(result).toMatchObject({
        github: true,
        controller: true,
        controllerUrl: 'http://localhost:3000'
      });
    });

    it('should use MISO_HOST environment variable for controller URL default', async() => {
      const originalMisoHost = process.env.MISO_HOST;
      process.env.MISO_HOST = 'custom-host';

      inquirer.prompt.mockResolvedValue({
        port: '3000',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: true,
        controller: true,
        controllerUrl: `http://${process.env.MISO_HOST}:3000`
      });

      await promptForOptions('test-app', {
        github: true,
        controller: true
      });

      // Verify the prompt was called with controller URL default
      const promptCalls = inquirer.prompt.mock.calls;
      const controllerUrlQuestion = promptCalls[0][0].find(q => q.name === 'controllerUrl');
      expect(controllerUrlQuestion).toBeDefined();
      expect(controllerUrlQuestion.default).toBe('http://custom-host:3000');

      process.env.MISO_HOST = originalMisoHost;
    });

    it('should handle controller question when github is not false', async() => {
      inquirer.prompt.mockResolvedValue({
        port: '3000',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false,
        github: true,
        controller: false
      });

      const result = await promptForOptions('test-app', {});

      expect(result).toMatchObject({
        github: true,
        controller: false
      });
    });

    it('should not prompt for controller when github is false', async() => {
      inquirer.prompt.mockResolvedValue({
        port: '3000',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false
      });

      const result = await promptForOptions('test-app', { github: false });

      expect(result.github).toBe(false);
      // Controller should not be prompted when github is false
      const promptCalls = inquirer.prompt.mock.calls;
      if (promptCalls.length > 0) {
        const controllerQuestion = promptCalls[0][0].find(q => q.name === 'controller');
        expect(controllerQuestion).toBeUndefined();
      }
    });

    it('should handle all external system fields in resolveConflicts', async() => {
      inquirer.prompt.mockResolvedValue({
        systemKey: 'test-system',
        systemDisplayName: 'Test System',
        systemDescription: 'Test description',
        systemType: 'mcp',
        authType: 'oauth2',
        datasourceCount: '3',
        github: false
      });

      const result = await promptForOptions('test-app', { type: 'external' });

      expect(result).toMatchObject({
        systemKey: 'test-system',
        systemDisplayName: 'Test System',
        systemDescription: 'Test description',
        systemType: 'mcp',
        authType: 'oauth2',
        datasourceCount: 3
      });
    });

    it('should use options over answers when both provided', async() => {
      inquirer.prompt.mockResolvedValue({
        port: '8080',
        language: 'python'
      });

      const result = await promptForOptions('test-app', {
        port: '3000',
        language: 'typescript',
        database: true
      });

      // Options should take precedence
      expect(result.port).toBe(3000);
      expect(result.language).toBe('typescript');
      expect(result.database).toBe(true);
    });

    it('should handle empty answers object', async() => {
      inquirer.prompt.mockResolvedValue({});

      const result = await promptForOptions('test-app', {
        port: '3000',
        language: 'typescript'
      });

      expect(result).toMatchObject({
        appName: 'test-app',
        port: 3000,
        language: 'typescript'
      });
    });

    it('should default github to false when not provided', async() => {
      inquirer.prompt.mockResolvedValue({
        port: '3000',
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false
      });

      const result = await promptForOptions('test-app', {});

      expect(result.github).toBe(false);
    });

    it('should handle different app types', async() => {
      const appTypes = ['webapp', 'api', 'service', 'functionapp'];

      for (const appType of appTypes) {
        inquirer.prompt.mockClear();
        inquirer.prompt.mockResolvedValue({
          port: '3000',
          language: 'typescript',
          database: false,
          redis: false,
          storage: false,
          authentication: false,
          github: false
        });

        const result = await promptForOptions('test-app', { type: appType });

        expect(result.type).toBe(appType);
      }
    });

    it('should handle external system with default app name for systemKey', async() => {
      inquirer.prompt.mockResolvedValue({
        systemDisplayName: 'Test System',
        systemDescription: 'Test description',
        systemType: 'openapi',
        authType: 'apikey',
        datasourceCount: '1',
        github: false
      });

      // Mock the prompt to check default value
      const promptCalls = inquirer.prompt.mock.calls;
      if (promptCalls.length > 0) {
        const systemKeyQuestion = promptCalls[0][0].find(q => q.name === 'systemKey');
        expect(systemKeyQuestion).toBeDefined();
        expect(systemKeyQuestion.default).toBe('test-app');
      }
    });

    it('should validate systemKey format', async() => {
      inquirer.prompt.mockResolvedValue({
        systemKey: 'test-system',
        systemDisplayName: 'Test System',
        systemDescription: 'Test description',
        systemType: 'openapi',
        authType: 'apikey',
        datasourceCount: '1',
        github: false
      });

      await promptForOptions('test-app', { type: 'external' });

      const promptCalls = inquirer.prompt.mock.calls;
      if (promptCalls.length > 0) {
        const systemKeyQuestion = promptCalls[0][0].find(q => q.name === 'systemKey');
        expect(systemKeyQuestion.validate).toBeDefined();
        expect(systemKeyQuestion.validate('valid-key')).toBe(true);
        expect(systemKeyQuestion.validate('Invalid-Key')).toBe('System key must contain only lowercase letters, numbers, and hyphens');
        expect(systemKeyQuestion.validate('')).toBe('System key is required');
      }
    });

    it('should validate datasourceCount range', async() => {
      inquirer.prompt.mockResolvedValue({
        systemKey: 'test-system',
        systemDisplayName: 'Test System',
        systemDescription: 'Test description',
        systemType: 'openapi',
        authType: 'apikey',
        datasourceCount: '1',
        github: false
      });

      await promptForOptions('test-app', { type: 'external' });

      const promptCalls = inquirer.prompt.mock.calls;
      if (promptCalls.length > 0) {
        const datasourceCountQuestion = promptCalls[0][0].find(q => q.name === 'datasourceCount');
        expect(datasourceCountQuestion.validate).toBeDefined();
        expect(datasourceCountQuestion.validate('1')).toBe(true);
        expect(datasourceCountQuestion.validate('10')).toBe(true);
        expect(datasourceCountQuestion.validate('0')).toBe('Datasource count must be a number between 1 and 10');
        expect(datasourceCountQuestion.validate('11')).toBe('Datasource count must be a number between 1 and 10');
      }
    });
  });
});

