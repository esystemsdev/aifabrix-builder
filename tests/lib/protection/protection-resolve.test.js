'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../lib/utils/paths', () => ({
  getAppsMaterializationParent: jest.fn()
}));

const { getAppsMaterializationParent } = require('../../../lib/utils/paths');
const {
  resolveProtectionManifest,
  datasourceKeyFromProtectionFilename
} = require('../../../lib/protection/resolve');
const { writeHubspotCompaniesManifest } = require('./protection-test-fixtures');

describe('protection resolve', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'protection-'));
    getAppsMaterializationParent.mockReset();
    getAppsMaterializationParent.mockReturnValue(tmpRoot);
    const protectionDir = path.join(tmpRoot, '.protection');
    writeHubspotCompaniesManifest(protectionDir);
    const altFixture = `apiVersion: dataplane.aifabrix.ai/v1
kind: Protection
metadata:
  key: alt-protection
  displayName: Alt
spec:
  enabled: true
  datasourceKey: hubspot-deals
  mode: replaceForSource
  rules:
    - key: r1
      principal:
        type: user
        field: metadata.email
      grants:
        - dimensionKey: country
          valueExpression: "US"
`;
    fs.writeFileSync(
      path.join(protectionDir, 'hubspot-protection-deals.yaml'),
      altFixture,
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('resolves preferred datasourceKey.yaml', () => {
    const resolved = resolveProtectionManifest('hubspot-companies');
    expect(resolved.manifestPath).toMatch(/hubspot-companies\.yaml$/);
    expect(resolved.manifest.spec.datasourceKey).toBe('hubspot-companies');
  });

  it('resolves hubspot-protection-companies filename pattern', () => {
    expect(datasourceKeyFromProtectionFilename('hubspot-protection-deals')).toBe('hubspot-deals');
    const resolved = resolveProtectionManifest('hubspot-deals');
    expect(resolved.manifest.spec.datasourceKey).toBe('hubspot-deals');
  });

  it('fails on duplicate spec.datasourceKey in folder', () => {
    const protectionDir = path.join(tmpRoot, '.protection');
    fs.copyFileSync(
      path.join(protectionDir, 'hubspot-companies.yaml'),
      path.join(protectionDir, 'dup-hubspot-companies.yaml')
    );
    expect(() => resolveProtectionManifest('hubspot-companies')).toThrow(/Duplicate spec\.datasourceKey/);
  });

  it('rejects .json extension on load via resolve with explicit path', () => {
    const protectionDir = path.join(tmpRoot, '.protection');
    const jsonPath = path.join(protectionDir, 'hubspot-companies.json');
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        apiVersion: 'dataplane.aifabrix.ai/v1',
        kind: 'Protection',
        metadata: { key: 'k', displayName: 'D' },
        spec: {
          enabled: true,
          datasourceKey: 'hubspot-companies',
          mode: 'replaceForSource',
          rules: [
            {
              key: 'r',
              principal: { type: 'user', field: 'metadata.email' },
              grants: [{ dimensionKey: 'country', valueExpression: 'x' }]
            }
          ]
        }
      })
    );
    expect(() => resolveProtectionManifest('hubspot-companies', jsonPath)).toThrow(/\.yaml only/);
  });
});
