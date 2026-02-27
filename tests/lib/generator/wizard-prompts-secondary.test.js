/**
 * Tests for Wizard Prompts Secondary
 *
 * @fileoverview Tests for lib/generator/wizard-prompts-secondary.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

const inquirer = require('inquirer');
const wizardPromptsSecondary = require('../../../lib/generator/wizard-prompts-secondary');

describe('Wizard Prompts Secondary', () => {
  let consoleLogSpy;

  describe('derivePreviewFromConfig', () => {
    it('should derive systemSummary and datasourceSummary from configs', () => {
      const systemConfig = {
        key: 'hubspot',
        displayName: 'HubSpot CRM',
        type: 'openapi',
        baseUrl: 'https://api.hubapi.com',
        authentication: { type: 'oauth2' },
        openapi: { operations: { list: {}, get: {} } }
      };
      const datasourceConfigs = [{
        key: 'hubspot-contact',
        entityType: 'record-storage',
        resourceType: 'contact',
        fieldMappings: { attributes: { id: {}, email: {}, firstName: {} } },
        exposed: { attributes: ['id', 'email'] }
      }];

      const derived = wizardPromptsSecondary.derivePreviewFromConfig(systemConfig, datasourceConfigs);

      expect(derived.systemSummary.key).toBe('hubspot');
      expect(derived.systemSummary.displayName).toBe('HubSpot CRM');
      expect(derived.systemSummary.endpointCount).toBe(2);
      expect(derived.datasourceSummary.key).toBe('hubspot-contact');
      expect(derived.datasourceSummary.entity).toBe('record-storage');
      expect(derived.fieldMappingsSummary.mappedFields).toEqual(['id', 'email', 'firstName']);
      expect(derived.datasourceSummary.exposedProfileCount).toBe(2);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('promptForConfigReview', () => {
    const systemConfig = { key: 'test-system', displayName: 'Test System' };
    const datasourceConfigs = [{ key: 'ds1', entityKey: 'entity1' }];

    it('should display preview summary when preview has systemSummary', async() => {
      const preview = {
        systemSummary: {
          key: 'hubspot',
          displayName: 'HubSpot CRM',
          type: 'openapi',
          baseUrl: 'https://api.hubapi.com',
          authenticationType: 'oauth2',
          endpointCount: 12
        },
        datasourceSummary: {
          key: 'hubspot-contacts',
          entity: 'Contact',
          resourceType: 'record-based',
          cipStepCount: 3,
          fieldMappingCount: 15,
          exposedProfileCount: 2
        }
      };
      inquirer.prompt.mockResolvedValue({ action: 'accept' });

      const result = await wizardPromptsSecondary.promptForConfigReview({
        preview,
        systemConfig,
        datasourceConfigs
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logged = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(logged).toContain('Configuration Preview (what will be created)');
      expect(logged).toContain('hubspot');
      expect(logged).toContain('HubSpot CRM');
      expect(logged).toContain('Contact');
      expect(logged).toContain('record-based');
      expect(result.action).toBe('accept');
    });

    it('should display derived summary when preview is null', async() => {
      inquirer.prompt.mockResolvedValue({ action: 'accept' });

      const result = await wizardPromptsSecondary.promptForConfigReview({
        preview: null,
        systemConfig,
        datasourceConfigs
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logged = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(logged).toContain('Configuration Preview (what will be created)');
      expect(logged).toContain('test-system');
      expect(logged).toContain('ds1');
      expect(result.action).toBe('accept');
    });

    it('should display derived summary when preview lacks systemSummary and datasourceSummary', async() => {
      inquirer.prompt.mockResolvedValue({ action: 'cancel' });

      const result = await wizardPromptsSecondary.promptForConfigReview({
        preview: {},
        systemConfig,
        datasourceConfigs
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logged = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(logged).toContain('Configuration Preview (what will be created)');
      expect(logged).toContain('test-system');
      expect(logged).toContain('ds1');
      expect(result.action).toBe('cancel');
    });

    it('should fall back to YAML when configs are empty and no preview', async() => {
      inquirer.prompt.mockResolvedValue({ action: 'accept' });

      await wizardPromptsSecondary.promptForConfigReview({
        preview: null,
        systemConfig: {},
        datasourceConfigs: []
      });

      const logged = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(logged).toContain('Configuration Preview');
    });

    it('should return cancel when user selects cancel', async() => {
      inquirer.prompt.mockResolvedValue({ action: 'cancel' });

      const result = await wizardPromptsSecondary.promptForConfigReview({
        preview: { systemSummary: { key: 'x' } },
        systemConfig,
        datasourceConfigs
      });

      expect(result.action).toBe('cancel');
    });
  });
});
