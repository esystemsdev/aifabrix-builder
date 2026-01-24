/**
 * Tests for External System Download Helpers Module
 *
 * @fileoverview Unit tests for lib/external-system/download-helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    readFileSync: jest.fn()
  };
});

jest.mock('../../../../lib/utils/paths', () => {
  const path = require('path');
  const actualPaths = jest.requireActual('../../../../lib/utils/paths');
  const actualFs = jest.requireActual('fs');

  // Determine project root - prioritize global.PROJECT_ROOT set by test setup
  let cachedProjectRoot = null;

  const getProjectRoot = jest.fn(() => {
    if (cachedProjectRoot) {
      return cachedProjectRoot;
    }

    // Strategy 1: Use global.PROJECT_ROOT if set (by test setup.js)
    if (global.PROJECT_ROOT) {
      const globalRoot = path.resolve(global.PROJECT_ROOT);
      if (actualFs.existsSync(path.join(globalRoot, 'package.json'))) {
        cachedProjectRoot = globalRoot;
        return cachedProjectRoot;
      }
    }

    // Strategy 2: Walk up from process.cwd() to find package.json
    let currentDir = process.cwd();
    for (let i = 0; i < 10; i++) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (actualFs.existsSync(packageJsonPath)) {
        cachedProjectRoot = path.resolve(currentDir);
        return cachedProjectRoot;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }

    // Strategy 3: Fallback to global.PROJECT_ROOT even if package.json check failed
    if (global.PROJECT_ROOT) {
      cachedProjectRoot = path.resolve(global.PROJECT_ROOT);
      return cachedProjectRoot;
    }

    // Last resort: use process.cwd()
    cachedProjectRoot = path.resolve(process.cwd());
    return cachedProjectRoot;
  });

  // Expose a way to set the project root for tests (used in beforeEach)
  getProjectRoot.__setProjectRoot = (root) => {
    cachedProjectRoot = path.resolve(root);
  };

  return {
    ...actualPaths,
    getProjectRoot
  };
});

const fs = require('fs');
const path = require('path');
const { getProjectRoot } = require('../../../../lib/utils/paths');
const {
  generateVariablesYaml,
  generateReadme
} = require('../../../../lib/external-system/download-helpers');

beforeEach(() => {
  jest.clearAllMocks();
  const actualFs = jest.requireActual('fs');

  // Get the actual project root - prioritize global.PROJECT_ROOT set by test setup
  let projectRoot;
  try {
    // Strategy 1: Use global.PROJECT_ROOT if set (by test setup.js) - most reliable
    if (global.PROJECT_ROOT && actualFs.existsSync(path.join(global.PROJECT_ROOT, 'package.json'))) {
      projectRoot = path.resolve(global.PROJECT_ROOT);
    } else {
      // Strategy 2: Use __dirname relative to test file
      projectRoot = path.resolve(__dirname, '../../../..');
      // Verify it's correct by checking for package.json
      if (!actualFs.existsSync(path.join(projectRoot, 'package.json'))) {
        // Strategy 3: Use process.cwd() if available
        const cwd = process.cwd();
        if (actualFs.existsSync(path.join(cwd, 'package.json'))) {
          projectRoot = path.resolve(cwd);
        } else {
          // Strategy 4: Fallback to global.PROJECT_ROOT even if package.json check failed
          projectRoot = path.resolve(global.PROJECT_ROOT || projectRoot);
        }
      }
    }
  } catch (error) {
    // Fallback to global.PROJECT_ROOT or __dirname approach
    projectRoot = path.resolve(global.PROJECT_ROOT || __dirname, '../../../..');
  }

  // Set the project root in the mocked getProjectRoot function
  if (getProjectRoot.__setProjectRoot) {
    getProjectRoot.__setProjectRoot(projectRoot);
  }

  const templatePath = path.join(projectRoot, 'templates', 'external-system', 'README.md.hbs');

  // Simple check: if path contains the template filename, it's the template
  const isTemplateFile = (filePath) => {
    if (!filePath) return false;
    const pathStr = String(filePath);
    return pathStr.includes('templates/external-system/README.md.hbs') ||
           pathStr.includes('templates\\external-system\\README.md.hbs') ||
           (pathStr.includes('external-system') && pathStr.includes('README.md.hbs'));
  };

  fs.existsSync.mockImplementation((filePath) => {
    if (!filePath) return false;

    if (isTemplateFile(filePath)) {
      // For template file, try to find it using real fs
      // Try the expected location first
      if (actualFs.existsSync(templatePath)) {
        return true;
      }
      // Try the requested path
      if (actualFs.existsSync(filePath)) {
        return true;
      }
      // If neither works, assume it exists (we'll handle reading in readFileSync)
      return true;
    }

    // For other files, use real fs
    return actualFs.existsSync(filePath);
  });

  fs.readFileSync.mockImplementation((filePath, encoding) => {
    if (!filePath) {
      throw new Error('File path is required');
    }

    if (isTemplateFile(filePath)) {
      // For template file, try to read from known locations
      const pathsToTry = [
        templatePath,  // Expected location
        filePath,      // Requested path
        path.join(projectRoot, 'templates', 'external-system', 'README.md.hbs')
      ];

      // Remove duplicates
      const uniquePaths = [...new Set(pathsToTry)];

      for (const tryPath of uniquePaths) {
        try {
          if (actualFs.existsSync(tryPath)) {
            return actualFs.readFileSync(tryPath, encoding || 'utf8');
          }
        } catch (error) {
          // Continue to next path
        }
      }

      // Last resort: try the requested path directly
      try {
        return actualFs.readFileSync(filePath, encoding || 'utf8');
      } catch (error) {
        throw new Error(`Template file not found. Tried: ${uniquePaths.join(', ')} and ${filePath}`);
      }
    }

    // For other files, use real fs
    return actualFs.readFileSync(filePath, encoding);
  });
});

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
        app: {
          key: 'hubspot',
          displayName: 'HubSpot Integration',
          description: 'HubSpot CRM integration',
          type: 'external'
        },
        deployment: {
          controllerUrl: '',
          environment: 'dev'
        },
        externalIntegration: {
          schemaBasePath: './',
          systems: ['hubspot-system.json'],
          dataSources: ['hubspot-datasource-contact.json', 'hubspot-datasource-company.json'],
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

      expect(result.app.displayName).toBe('salesforce');
    });

    it('should generate default description if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateVariablesYaml(systemKey, application, dataSources);

      expect(result.app.description).toBe('External system integration for salesforce');
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
        'hubspot-datasource-contact.json',
        'hubspot-datasource-company.json'
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
        'hubspot-datasource-contact.json',
        'hubspot-datasource-company.json'
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
        'hubspot-datasource-contact.json',
        'hubspot-datasource-company.json'
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
        'hubspot-datasource-custom-object-123.json'
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
      expect(result).toContain('`hubspot-system.json`');
      expect(result).toContain('`hubspot-datasource-contact.json`');
      expect(result).toContain('`hubspot-datasource-company.json`');
      expect(result).toContain('Datasource: Contacts');
      expect(result).toContain('Datasource: Companies');
      expect(result).toContain('`env.template`');
      expect(result).toContain('aifabrix validate hubspot --type external');
      expect(result).toContain('aifabrix json hubspot --type external');
      expect(result).toContain('aifabrix deploy hubspot --controller <url> --environment dev');
    });

    it('should use systemKey as displayName if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('# Salesforce');
    });

    it('should generate default description if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('External system integration for salesforce');
    });

    it('should use openapi as system type if not provided', () => {
      const systemKey = 'salesforce';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('**System Type**: `openapi`');
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

      expect(result).toContain('`hubspot-datasource-contact.json`');
      expect(result).toContain('`hubspot-datasource-company.json`');
      expect(result).toContain('`hubspot-datasource-deal.json`');
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

      expect(result).toContain('## Quick Start');
      expect(result).toContain('Create External System');
      expect(result).toContain('Configure Authentication and Datasources');
      expect(result).toContain('Validate Configuration');
      expect(result).toContain('Generate Deployment JSON');
    });

    it('should include testing section', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('## Testing');
      expect(result).toContain('Unit Tests (Local Validation)');
      expect(result).toContain('Integration Tests (Via Dataplane)');
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
      expect(result).toContain('`salesforce-system.json`');
      expect(result).not.toContain('Datasource:');
    });

    it('should extract entityType from key when entityType and entityKey not provided', () => {
      const systemKey = 'hubspot';
      const application = {};
      const dataSources = [
        { key: 'hubspot-custom-entity' }
      ];

      const result = generateReadme(systemKey, application, dataSources);

      expect(result).toContain('`hubspot-datasource-custom-entity.json`');
    });
  });
});

