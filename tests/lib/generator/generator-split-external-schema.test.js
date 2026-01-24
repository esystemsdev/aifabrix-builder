/**
 * Tests for splitExternalApplicationSchema
 *
 * @fileoverview Unit tests for external application schema split
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn()
    }
  };
});

jest.mock('../../../lib/utils/external-system-env-helpers', () => ({
  generateEnvTemplate: jest.fn(() => 'ENV=VALUE')
}));

jest.mock('../../../lib/utils/external-readme', () => ({
  generateExternalReadmeContent: jest.fn(() => '# External README')
}));

describe('splitExternalApplicationSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should split application-schema.json into component files', async() => {
    const schemaPath = path.join(process.cwd(), 'integration', 'testext', 'application-schema.json');
    const outputDir = path.join(process.cwd(), 'integration', 'testext');
    const schema = {
      version: '1.0.0',
      application: {
        key: 'testext',
        displayName: 'Test External',
        description: 'Test external system',
        type: 'openapi',
        roles: [{ name: 'Admin', value: 'admin' }],
        permissions: [{ name: 'external:read', roles: ['admin'] }]
      },
      dataSources: [
        { key: 'testext-deploy-entity1', entityType: 'entity1', systemKey: 'testext' }
      ]
    };

    fs.promises.readFile.mockResolvedValue(JSON.stringify(schema));
    fs.promises.writeFile.mockResolvedValue();
    fs.promises.mkdir.mockResolvedValue();

    const { splitExternalApplicationSchema } = require('../../../lib/generator/external');
    const result = await splitExternalApplicationSchema(schemaPath, outputDir);

    expect(fs.promises.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });
    // New naming convention: system file uses -system.json
    expect(result.systemFile).toBe(path.join(outputDir, 'testext-system.json'));
    // New naming convention: datasource files use -datasource- prefix
    // Key 'testext-deploy-entity1' - the extraction logic keeps 'deploy-entity1' part
    expect(result.datasourceFiles[0]).toBe(path.join(outputDir, 'testext-datasource-deploy-entity1.json'));
    expect(result.variables).toBe(path.join(outputDir, 'variables.yaml'));
    expect(result.envTemplate).toBe(path.join(outputDir, 'env.template'));
    expect(result.readme).toBe(path.join(outputDir, 'README.md'));
    expect(result.rbac).toBe(path.join(outputDir, 'rbac.yml'));
  });

  it('should throw when application is missing', async() => {
    const schemaPath = path.join(process.cwd(), 'integration', 'testext', 'application-schema.json');
    const outputDir = path.join(process.cwd(), 'integration', 'testext');
    fs.promises.readFile.mockResolvedValue(JSON.stringify({ dataSources: [] }));

    const { splitExternalApplicationSchema } = require('../../../lib/generator/external');
    await expect(splitExternalApplicationSchema(schemaPath, outputDir))
      .rejects.toThrow('application-schema.json must include an "application" object');
  });
});
