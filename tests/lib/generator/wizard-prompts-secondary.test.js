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

    it('should derive datasourceSummaries for multiple datasources', () => {
      const systemConfig = { key: 'hubspot', displayName: 'HubSpot CRM', type: 'openapi' };
      const datasourceConfigs = [
        { key: 'hubspot-contact', entityType: 'record-storage', resourceType: 'contact' },
        { key: 'hubspot-company', entityType: 'record-storage', resourceType: 'company' }
      ];
      const derived = wizardPromptsSecondary.derivePreviewFromConfig(systemConfig, datasourceConfigs);
      expect(derived.datasourceSummaries).toHaveLength(2);
      expect(derived.datasourceSummaries[0].key).toBe('hubspot-contact');
      expect(derived.datasourceSummaries[1].key).toBe('hubspot-company');
      expect(derived.datasourceSummary).toBeUndefined();
    });

    it('should override system key and displayName and rewrite datasource keys when appKey is provided', () => {
      const systemConfig = {
        key: 'companies',
        displayName: 'Companies',
        type: 'openapi',
        openapi: { operations: {} }
      };
      const datasourceConfigs = [{
        key: 'companies-companies',
        entityType: 'recordStorage',
        resourceType: 'record',
        fieldMappings: { attributes: { id: {}, name: {} } }
      }];
      const derived = wizardPromptsSecondary.derivePreviewFromConfig(systemConfig, datasourceConfigs, 'hubspot-demo');
      expect(derived.systemSummary.key).toBe('hubspot-demo');
      expect(derived.systemSummary.displayName).toBe('Hubspot Demo');
      expect(derived.datasourceSummary.key).toBe('hubspot-demo-companies');
      expect(derived.datasourceSummary.entity).toBe('recordStorage');
    });

    it('should keep existing behavior when appKey is not provided', () => {
      const systemConfig = { key: 'companies', displayName: 'Companies', type: 'openapi' };
      const datasourceConfigs = [{ key: 'companies-companies', entityType: 'recordStorage' }];
      const derived = wizardPromptsSecondary.derivePreviewFromConfig(systemConfig, datasourceConfigs);
      expect(derived.systemSummary.key).toBe('companies');
      expect(derived.systemSummary.displayName).toBe('Companies');
      expect(derived.datasourceSummary.key).toBe('companies-companies');
    });

    it('should derive baseUrl and auth from authentication.variables.baseUrl and authentication.method', () => {
      const systemConfig = {
        key: 'demo',
        displayName: 'Demo',
        type: 'openapi',
        authentication: {
          method: 'apikey',
          variables: { baseUrl: 'https://api.demo.com' },
          security: { apiKey: 'kv://demo/apiKey' }
        },
        openapi: { documentKey: 'demo-api' }
      };
      const datasourceConfigs = [{ key: 'demo-companies', entityType: 'recordStorage', resourceType: 'record' }];
      const derived = wizardPromptsSecondary.derivePreviewFromConfig(systemConfig, datasourceConfigs);
      expect(derived.systemSummary.baseUrl).toBe('https://api.demo.com');
      expect(derived.systemSummary.authenticationType).toBe('apikey');
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

    it('should display appKey-based system and datasource keys when preview is null and appKey is provided', async() => {
      inquirer.prompt.mockResolvedValue({ action: 'accept' });

      const result = await wizardPromptsSecondary.promptForConfigReview({
        preview: null,
        systemConfig,
        datasourceConfigs,
        appKey: 'my-app'
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logged = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(logged).toContain('Configuration Preview (what will be created)');
      expect(logged).toContain('my-app');
      expect(logged).toContain('My App');
      expect(logged).toContain('my-app-entity1');
      expect(result.action).toBe('accept');
    });

    it('should display derived summary when preview lacks systemSummary and datasourceSummary', async() => {
      inquirer.prompt.mockResolvedValue({ action: 'cancel' });

      const result = await wizardPromptsSecondary.promptForConfigReview({
        preview: {},
        systemConfig,
        datasourceConfigs,
        appKey: 'my-app'
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logged = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(logged).toContain('Configuration Preview (what will be created)');
      expect(logged).toContain('my-app');
      expect(logged).toContain('My App');
      expect(logged).toContain('my-app-entity1');
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

  describe('promptForEntitySelection', () => {
    it('prompts and returns selected entity', async() => {
      const entities = [
        { name: 'companies', pathCount: 12 },
        { name: 'deals', pathCount: 10 }
      ];
      inquirer.prompt.mockResolvedValue({ entityName: 'companies' });

      const result = await wizardPromptsSecondary.promptForEntitySelection(entities);

      expect(result).toBe('companies');
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'entityName',
          message: 'Select entity for datasource generation:',
          pageSize: 10,
          choices: [
            { name: 'companies (12 paths)', value: 'companies' },
            { name: 'deals (10 paths)', value: 'deals' }
          ]
        })
      ]);
    });

    it('formats choices without pathCount', async() => {
      const entities = [{ name: 'contacts' }];
      inquirer.prompt.mockResolvedValue({ entityName: 'contacts' });

      await wizardPromptsSecondary.promptForEntitySelection(entities);

      const call = inquirer.prompt.mock.calls[0][0][0];
      expect(call.choices).toEqual([{ name: 'contacts', value: 'contacts' }]);
    });

    it('throws when entities is empty', async() => {
      await expect(wizardPromptsSecondary.promptForEntitySelection([]))
        .rejects.toThrow('At least one entity is required');
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });
  });
});
