/**
 * Roundtrip tests: download output must pass validate.
 * Simulates validate → deploy → download → validate flow.
 *
 * @fileoverview Roundtrip validation for external system download
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Use real fs so the deploy JSON is written to disk and split can find it
// (other test files may mock fs, which would make writeFile a no-op in this worker)
jest.unmock('fs');

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const validate = require('../../../lib/validation/validate');
const { getProjectRoot } = require('../../../lib/utils/paths');

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
          clientId: 'kv://roundtrip-test/clientid',
          clientSecret: 'kv://roundtrip-test/clientsecret'
        }
      },
      configuration: [
        {
          name: 'KV_ROUNDTRIP_TEST_CLIENTID',
          value: 'roundtrip-test/clientid',
          location: 'keyvault',
          required: true
        },
        {
          name: 'KV_ROUNDTRIP_TEST_CLIENTSECRET',
          value: 'roundtrip-test/clientsecret',
          location: 'keyvault',
          required: true
        }
      ],
      dataSources: ['roundtrip-test-company']
    };
    const datasource = {
      key: 'roundtrip-test-company',
      displayName: 'Company',
      systemKey,
      entityType: 'record-storage',
      resourceType: 'customer',
      fieldMappings: {
        dimensions: { country: 'metadata.country' },
        attributes: {
          country: { expression: '{{metadata.country}}', type: 'string' }
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
      generatorLocal = require('../../../lib/generator');
    });
    await generatorLocal.splitDeployJson(deployPath, testDir);

    const result = await validate.validateAppOrFile(systemKey);

    expect(result.valid).toBe(true);
    expect(result.errors || []).toHaveLength(0);
  });
});
