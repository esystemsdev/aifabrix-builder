/**
 * Roundtrip tests: download output must pass validate.
 * Simulates validate → deploy → download → validate flow.
 * Excluded from CI (tests/manual) due to fs/path sensitivity in copied project.
 *
 * @fileoverview Roundtrip validation for external system download
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
// Use real fs for this file so deploy JSON is written and split can find it
// (other test files in the same worker may mock fs; requireActual bypasses the mock)
const fsActual = jest.requireActual('fs');
const fs = fsActual.promises;
const fsSync = fsActual;

const validate = require('../../lib/validation/validate');
const { getProjectRoot } = require('../../lib/utils/paths');

describe('External System Download Roundtrip', () => {
  const systemKey = 'roundtrip-test';
  let testDir;

  beforeAll(async() => {
    const projectRoot = getProjectRoot();
    testDir = path.join(projectRoot, 'integration', systemKey);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async() => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  /**
   * Builds deploy JSON matching download output: system with auth.security,
   * datasources, configuration augmented for env.template.
   */
  function buildRoundtripDeployJson() {
    const system = {
      key: systemKey,
      displayName: 'Roundtrip Test',
      description: 'Roundtrip validation test',
      type: 'openapi',
      enabled: true,
      authentication: {
        method: 'oauth2',
        variables: {
          baseUrl: 'https://api.example.com',
          tokenUrl: 'https://api.example.com/oauth/token',
          authorizationUrl: 'https://api.example.com/oauth/authorize'
        },
        security: {
          clientId: `kv://${systemKey}/clientId`,
          clientSecret: `kv://${systemKey}/clientSecret`
        }
      },
      configuration: [
        {
          name: 'KV_ROUNDTRIP_TEST_CLIENTID',
          value: `${systemKey}/clientId`,
          location: 'keyvault',
          required: true
        },
        {
          name: 'KV_ROUNDTRIP_TEST_CLIENTSECRET',
          value: `${systemKey}/clientSecret`,
          location: 'keyvault',
          required: true
        }
      ],
      dataSources: ['roundtrip-test-company']
    };
    const datasource = {
      key: `${systemKey}-company`,
      displayName: 'Company',
      systemKey,
      entityType: 'recordStorage',
      resourceType: 'record',
      primaryKey: ['id'],
      labelKey: ['id'],
      metadataSchema: {
        type: 'object',
        required: ['id', 'externalId'],
        properties: {
          id: { type: 'string', index: true },
          externalId: { type: 'string', index: true }
        }
      },
      fieldMappings: {
        attributes: {
          id: { expression: '{{raw.id}}' },
          externalId: { expression: '{{raw.externalId}}' }
        }
      },
      exposed: {
        schema: {
          id: 'metadata.id',
          externalId: 'metadata.externalId'
        }
      }
    };
    return {
      system,
      dataSources: [datasource]
    };
  }

  it('should pass validate after split of deploy JSON with auth config', async() => {
    const deploy = buildRoundtripDeployJson();
    const deployPath = path.resolve(path.join(testDir, `${systemKey}-deploy.json`));

    // Write with sync fs so the file is on disk before isolateModules loads split (same fs split uses)
    fsSync.writeFileSync(deployPath, JSON.stringify(deploy, null, 2), 'utf8');
    if (!fsSync.existsSync(deployPath)) {
      throw new Error(`Deploy JSON was not written (fs may be mocked): ${deployPath}`);
    }

    // Force fresh require of generator so it uses real fs (not a cached mock from other tests)
    let generatorLocal;
    jest.isolateModules(() => {
      generatorLocal = require('../../lib/generator');
    });
    await generatorLocal.splitDeployJson(deployPath, testDir);

    const result = await validate.validateAppOrFile(systemKey);

    expect(result.valid).toBe(true);
    expect(result.errors || []).toHaveLength(0);
  });
});
