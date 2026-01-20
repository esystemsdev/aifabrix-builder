/**
 * Tests for External System Generator RBAC Support
 *
 * @fileoverview Unit tests for external system template generation with RBAC
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const externalSystemGenerator = require('../../../lib/external-system/generator');

// Mock fs module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  const mockFs = {
    ...actualFs,
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
            Groups: ['admins@company.com']
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
      fs.promises.writeFile.mockResolvedValue();

      const result = await externalSystemGenerator.generateExternalSystemTemplate(appPath, systemKey, config);

      expect(result).toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalled();

      // Verify the generated JSON contains roles and permissions
      const writtenContent = fs.promises.writeFile.mock.calls[0][1];
      const parsed = JSON.parse(writtenContent);

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
      fs.promises.writeFile.mockResolvedValue();

      const result = await externalSystemGenerator.generateExternalSystemTemplate(appPath, systemKey, config);

      expect(result).toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalled();

      // Verify the generated JSON does not contain roles/permissions
      const writtenContent = fs.promises.writeFile.mock.calls[0][1];
      const parsed = JSON.parse(writtenContent);
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
      fs.promises.writeFile.mockResolvedValue();

      const result = await externalSystemGenerator.generateExternalSystemTemplate(appPath, systemKey, config);

      expect(result).toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalled();

      // Verify the generated JSON contains roles without Groups
      const writtenContent = fs.promises.writeFile.mock.calls[0][1];
      const parsed = JSON.parse(writtenContent);
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
      fs.promises.writeFile.mockResolvedValue();

      const result = await externalSystemGenerator.generateExternalSystemTemplate(appPath, systemKey, config);

      expect(result).toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalled();

      // Verify empty arrays are handled (should not include roles/permissions in JSON)
      const writtenContent = fs.promises.writeFile.mock.calls[0][1];
      const parsed = JSON.parse(writtenContent);
      // Handlebars {{#if}} checks for truthy, empty arrays are truthy but won't render content
      // So roles/permissions should not appear in the output
      expect(parsed.roles).toBeUndefined();
      expect(parsed.permissions).toBeUndefined();
    });
  });
});

