/**
 * Tests for External System Generator RBAC Support
 *
 * @fileoverview Unit tests for external system template generation with RBAC
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');

jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn(),
  writeConfigFile: jest.fn()
}));

const configFormat = require('../../../lib/utils/config-format');
const externalSystemGenerator = require('../../../lib/external-system/generator');

// Mock fs module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const mockFs = {
    ...actualFs,
    writeFileSync: jest.fn(),
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn()
    }
  };
  return mockFs;
});

describe('External System Generator RBAC Support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateExternalSystemTemplate with roles/permissions', () => {
    it('should generate external system JSON with roles and permissions from config', async() => {
      const appPath = path.join(process.cwd(), 'integration', 'testexternal');
      const systemKey = 'testexternal';
      const config = {
        systemDisplayName: 'Test External',
        systemDescription: 'Test external system',
        systemType: 'openapi',
        authType: 'apikey',
        roles: [
          {
            name: 'External Admin',
            value: 'external-admin',
            description: 'Admin access',
            groups: ['admins@company.com']
          },
          {
            name: 'External User',
            value: 'external-user',
            description: 'User access'
          }
        ],
        permissions: [
          {
            name: 'external:read',
            roles: ['external-user', 'external-admin'],
            description: 'Read access'
          },
          {
            name: 'external:write',
            roles: ['external-admin'],
            description: 'Write access'
          }
        ]
      };

      const templateContent = `{
  "key": "{{systemKey}}",
  "displayName": "{{systemDisplayName}}",
  "description": "{{systemDescription}}",
  "type": "{{systemType}}",
  "enabled": true,
  "authentication": {
    "mode": "{{authType}}"
  },
  "tags": []{{#if roles}},
  "roles": [
    {{#each roles}}
    {
      "name": "{{name}}",
      "value": "{{value}}",
      "description": "{{description}}"{{#if Groups}},
      "groups": [{{#each Groups}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{/if}}
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]{{/if}}{{#if permissions}},
  "permissions": [
    {{#each permissions}}
    {
      "name": "{{name}}",
      "roles": [{{#each roles}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}],
      "description": "{{description}}"
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]{{/if}}
}`;

      fs.promises.readFile.mockResolvedValue(templateContent);
      configFormat.writeConfigFile.mockImplementation(() => {});

      const result = await externalSystemGenerator.generateExternalSystemTemplate(appPath, systemKey, config);

      expect(result).toBeDefined();
      expect(configFormat.writeConfigFile).toHaveBeenCalled();

      // Verify the generated config contains roles and permissions
      const systemCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-system.yaml'));
      const parsed = systemCall[1];

      // The template outputs 'groups' (lowercase) for the groups array
      // while the config uses 'Groups' (uppercase) as the input key
      const expectedRoles = config.roles.map(role => {
        const expected = {
          name: role.name,
          value: role.value,
          description: role.description
        };
        // Template converts Groups -> groups in output
        if (role.Groups) {
          expected.groups = role.Groups;
        }
        return expected;
      });
      expect(parsed.roles).toEqual(expectedRoles);
      expect(parsed.permissions).toEqual(config.permissions);
    });

    it('should generate external system JSON without roles/permissions when not provided', async() => {
      const appPath = path.join(process.cwd(), 'integration', 'testexternal');
      const systemKey = 'testexternal';
      const config = {
        systemDisplayName: 'Test External',
        systemDescription: 'Test external system',
        systemType: 'openapi',
        authType: 'apikey'
      };

      const templateContent = `{
  "key": "{{systemKey}}",
  "displayName": "{{systemDisplayName}}",
  "description": "{{systemDescription}}",
  "type": "{{systemType}}",
  "enabled": true,
  "authentication": {
    "mode": "{{authType}}"
  },
  "tags": []{{#if roles}},
  "roles": [
    {{#each roles}}
    {
      "name": "{{name}}",
      "value": "{{value}}",
      "description": "{{description}}"{{#if Groups}},
      "groups": [{{#each Groups}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{/if}}
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]{{/if}}{{#if permissions}},
  "permissions": [
    {{#each permissions}}
    {
      "name": "{{name}}",
      "roles": [{{#each roles}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}],
      "description": "{{description}}"
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]{{/if}}
}`;

      fs.promises.readFile.mockResolvedValue(templateContent);
      configFormat.writeConfigFile.mockImplementation(() => {});

      const result = await externalSystemGenerator.generateExternalSystemTemplate(appPath, systemKey, config);

      expect(result).toBeDefined();
      expect(configFormat.writeConfigFile).toHaveBeenCalled();

      // Verify the generated config does not contain roles/permissions
      const systemCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-system.yaml'));
      const parsed = systemCall[1];
      expect(parsed.roles).toBeUndefined();
      expect(parsed.permissions).toBeUndefined();
    });

    it('should handle roles without Groups property', async() => {
      const appPath = path.join(process.cwd(), 'integration', 'testexternal');
      const systemKey = 'testexternal';
      const config = {
        systemDisplayName: 'Test External',
        systemDescription: 'Test external system',
        systemType: 'openapi',
        authType: 'apikey',
        roles: [
          {
            name: 'External User',
            value: 'external-user',
            description: 'User access'
            // No Groups property
          }
        ],
        permissions: [
          {
            name: 'external:read',
            roles: ['external-user'],
            description: 'Read access'
          }
        ]
      };

      const templateContent = `{
  "key": "{{systemKey}}",
  "displayName": "{{systemDisplayName}}",
  "description": "{{systemDescription}}",
  "type": "{{systemType}}",
  "enabled": true,
  "authentication": {
    "mode": "{{authType}}"
  },
  "tags": []{{#if roles}},
  "roles": [
    {{#each roles}}
    {
      "name": "{{name}}",
      "value": "{{value}}",
      "description": "{{description}}"{{#if Groups}},
      "groups": [{{#each Groups}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{/if}}
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]{{/if}}{{#if permissions}},
  "permissions": [
    {{#each permissions}}
    {
      "name": "{{name}}",
      "roles": [{{#each roles}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}],
      "description": "{{description}}"
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]{{/if}}
}`;

      fs.promises.readFile.mockResolvedValue(templateContent);
      configFormat.writeConfigFile.mockImplementation(() => {});

      const result = await externalSystemGenerator.generateExternalSystemTemplate(appPath, systemKey, config);

      expect(result).toBeDefined();
      expect(configFormat.writeConfigFile).toHaveBeenCalled();

      // Verify the generated config contains roles without Groups
      const systemCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-system.yaml'));
      const parsed = systemCall[1];
      expect(parsed.roles).toEqual(config.roles);
      expect(parsed.roles[0].Groups).toBeUndefined();
    });

    it('should handle empty roles/permissions arrays', async() => {
      const appPath = path.join(process.cwd(), 'integration', 'testexternal');
      const systemKey = 'testexternal';
      const config = {
        systemDisplayName: 'Test External',
        systemDescription: 'Test external system',
        systemType: 'openapi',
        authType: 'apikey',
        roles: [],
        permissions: []
      };

      const templateContent = `{
  "key": "{{systemKey}}",
  "displayName": "{{systemDisplayName}}",
  "description": "{{systemDescription}}",
  "type": "{{systemType}}",
  "enabled": true,
  "authentication": {
    "mode": "{{authType}}"
  },
  "tags": []{{#if roles}},
  "roles": [
    {{#each roles}}
    {
      "name": "{{name}}",
      "value": "{{value}}",
      "description": "{{description}}"{{#if Groups}},
      "roups": [{{#each Groups}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]{{/if}}
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]{{/if}}{{#if permissions}},
  "permissions": [
    {{#each permissions}}
    {
      "name": "{{name}}",
      "roles": [{{#each roles}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}],
      "description": "{{description}}"
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]{{/if}}
}`;

      fs.promises.readFile.mockResolvedValue(templateContent);
      configFormat.writeConfigFile.mockImplementation(() => {});

      const result = await externalSystemGenerator.generateExternalSystemTemplate(appPath, systemKey, config);

      expect(result).toBeDefined();
      expect(configFormat.writeConfigFile).toHaveBeenCalled();

      // Verify empty arrays are handled (should not include roles/permissions in output)
      const systemCall = configFormat.writeConfigFile.mock.calls.find(c => c[0] && String(c[0]).includes('-system.yaml'));
      const parsed = systemCall[1];
      expect(parsed.roles).toBeUndefined();
      expect(parsed.permissions).toBeUndefined();
    });
  });
});

