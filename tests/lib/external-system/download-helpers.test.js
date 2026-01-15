/**
 * Tests for External System Download Helpers Module
 *
 * @fileoverview Unit tests for lib/external-system/download-helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  generateVariablesYaml,
  generateReadme
} = require('../../../lib/external-system/download-helpers');

describe('External System Download Helpers Module', () => {
  describe('generateVariablesYaml', () => {
    it('should generate variables.yaml with system and datasources', () => {
      const systemKey = 'hubspot';
      const application = {
        displayName: 'HubSpot Integration',
        description: 'HubSpot CRM integration',
        version: '2.0.0'
      };
      const dataSources = [
        { key: 'hubspot-contact', entityType: 'contact', displayName: 'Contacts' },
        { key: 'hubspot-company', entityType: 'company', displayName: 'Companies' }
      ];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result).toEqual({
        name: 'hubspot',
        displayName: 'HubSpot Integration',
        description: 'HubSpot CRM integration',
        externalIntegration: {
          schemaBasePath: './',
          systems: ['hubspot-deploy.json'],
          dataSources: ['hubspot-deploy-contact.json', 'hubspot-deploy-company.json'],
          autopublish: false,
          version: '2.0.0'
        }
      });
    });

    it('should use systemKey as displayName if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result.displayName).toBe('salesforce');
    });

    it('should generate default description if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result.description).toBe('External system integration for salesforce');
    });

    it('should use default version if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result.externalIntegration.version).toBe('1.0.0');
    });

    it('should extract entityType from entityType field', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [
        { key: 'hubspot-contact', entityType: 'contact' },
        { key: 'hubspot-company', entityType: 'company' }
      ];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result.externalIntegration.dataSources).toEqual([
        'hubspot-deploy-contact.json',
        'hubspot-deploy-company.json'
      ]);
    });

    it('should extract entityType from entityKey field if entityType not provided', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [
        { key: 'hubspot-contact', entityKey: 'contact' },
        { key: 'hubspot-company', entityKey: 'company' }
      ];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result.externalIntegration.dataSources).toEqual([
        'hubspot-deploy-contact.json',
        'hubspot-deploy-company.json'
      ]);
    });

    it('should extract entityType from key if neither entityType nor entityKey provided', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [
        { key: 'hubspot-contact' },
        { key: 'hubspot-company' }
      ];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result.externalIntegration.dataSources).toEqual([
        'hubspot-deploy-contact.json',
        'hubspot-deploy-company.json'
      ]);
    });

    it('should handle empty datasources array', () => {
      const systemKey = 'salesforce';
      const application = { displayName: 'Salesforce' };
      const dataSources = [];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result.externalIntegration.dataSources).toEqual([]);
    });

    it('should handle datasources with complex key patterns', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [
        { key: 'hubspot-custom-object-123' }
      ];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result.externalIntegration.dataSources).toEqual([
        'hubspot-deploy-123.json'
      ]);
    });
  });

  describe('generateReadme', () => {
    it('should generate README with all information', () => {
      const systemKey = 'hubspot';
      const application = {
        displayName: 'HubSpot Integration',
        description: 'HubSpot CRM integration',
        type: 'crm'
      };
      const dataSources = [
        { key: 'hubspot-contact', entityType: 'contact', displayName: 'Contacts' },
        { key: 'hubspot-company', entityType: 'company', displayName: 'Companies' }
      ];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('# HubSpot Integration');
      expect(result).toContain('HubSpot CRM integration');
      expect(result).toContain('**System Key**: `hubspot`');
      expect(result).toContain('**System Type**: `crm`');
      expect(result).toContain('**Datasources**: 2');
      expect(result).toContain('`hubspot-deploy.json`');
      expect(result).toContain('`hubspot-deploy-contact.json`');
      expect(result).toContain('`hubspot-deploy-company.json`');
      expect(result).toContain('Datasource: Contacts');
      expect(result).toContain('Datasource: Companies');
      expect(result).toContain('`env.template`');
      expect(result).toContain('aifabrix test hubspot');
      expect(result).toContain('aifabrix test-integration hubspot');
      expect(result).toContain('aifabrix deploy hubspot');
    });

    it('should use systemKey as displayName if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('# salesforce');
    });

    it('should generate default description if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('External system integration for salesforce');
    });

    it('should use unknown as system type if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('**System Type**: `unknown`');
    });

    it('should show correct datasource count', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [
        { key: 'hubspot-contact' },
        { key: 'hubspot-company' },
        { key: 'hubspot-deal' }
      ];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('**Datasources**: 3');
    });

    it('should list all datasource files', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [
        { key: 'hubspot-contact', entityType: 'contact' },
        { key: 'hubspot-company', entityType: 'company' },
        { key: 'hubspot-deal', entityType: 'deal' }
      ];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('`hubspot-deploy-contact.json`');
      expect(result).toContain('`hubspot-deploy-company.json`');
      expect(result).toContain('`hubspot-deploy-deal.json`');
    });

    it('should use datasource key as displayName if not provided', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [
        { key: 'hubspot-contact', entityType: 'contact' }
      ];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('Datasource: hubspot-contact');
    });

    it('should include setup instructions', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('## Setup Instructions');
      expect(result).toContain('1. Review and update configuration files as needed');
      expect(result).toContain('2. Set up environment variables in `env.template`');
      expect(result).toContain('3. Run unit tests:');
      expect(result).toContain('4. Run integration tests:');
      expect(result).toContain('5. Deploy:');
    });

    it('should include testing section', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('## Testing');
      expect(result).toContain('### Unit Tests');
      expect(result).toContain('### Integration Tests');
    });

    it('should include deployment section', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('## Deployment');
      expect(result).toContain('Deploy to dataplane via miso-controller:');
    });

    it('should handle empty datasources array', () => {
      const systemKey = 'salesforce';
      const application = { displayName: 'Salesforce' };
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('**Datasources**: 0');
      expect(result).toContain('`salesforce-deploy.json`');
      expect(result).not.toContain('Datasource:');
    });

    it('should extract entityType from key when entityType and entityKey not provided', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [
        { key: 'hubspot-custom-entity' }
      ];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('`hubspot-deploy-entity.json`');
    });
  });
});

