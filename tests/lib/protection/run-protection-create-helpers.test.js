'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn()
}));

jest.mock('../../../lib/protection/paths', () => ({
  getProtectionRoot: jest.fn()
}));

const { getConfig } = require('../../../lib/core/config');
const { getProtectionRoot } = require('../../../lib/protection/paths');
const {
  resolveProtectionOutputFormat,
  resolveOutputPathOrThrow,
  writeProtectionManifest,
  protectionManifestToDisplayText
} = require('../../../lib/protection/run-protection-create-helpers');
const { readHubspotCompaniesYaml } = require('./protection-test-fixtures');

describe('run-protection-create-helpers', () => {
  let tmpRoot;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prot-create-helpers-'));
    getProtectionRoot.mockImplementation(() => tmpRoot);
  });

  afterEach(() => {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
      } catch {
        /* best-effort */
      }
    }
  });

  it('resolveProtectionOutputFormat returns json when config.format is json', async() => {
    getConfig.mockResolvedValue({ format: 'json' });
    await expect(resolveProtectionOutputFormat()).resolves.toBe('json');
  });

  it('resolveProtectionOutputFormat defaults to yaml', async() => {
    getConfig.mockResolvedValue({});
    await expect(resolveProtectionOutputFormat()).resolves.toBe('yaml');
    getConfig.mockResolvedValue({ format: 'yaml' });
    await expect(resolveProtectionOutputFormat()).resolves.toBe('yaml');
  });

  it('resolveOutputPathOrThrow uses .json extension when format is json', async() => {
    getConfig.mockResolvedValue({ format: 'json' });
    const { outputPath, format } = await resolveOutputPathOrThrow('hubspot-companies', false);
    expect(format).toBe('json');
    expect(outputPath).toBe(path.join(tmpRoot, 'hubspot-companies.json'));
  });

  it('resolveOutputPathOrThrow uses .yaml extension by default', async() => {
    getConfig.mockResolvedValue({});
    const { outputPath, format } = await resolveOutputPathOrThrow('hubspot-companies', false);
    expect(format).toBe('yaml');
    expect(outputPath).toBe(path.join(tmpRoot, 'hubspot-companies.yaml'));
  });

  it('writeProtectionManifest writes parseable JSON when format is json', () => {
    const yaml = require('js-yaml');
    const manifest = yaml.load(readHubspotCompaniesYaml(__dirname));
    const outputPath = path.join(tmpRoot, 'hubspot-companies.json');
    writeProtectionManifest(outputPath, manifest, 'json');
    expect(fs.existsSync(outputPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    expect(parsed.spec.datasourceKey).toBe('hubspot-companies');
    expect(path.extname(outputPath)).toBe('.json');
  });

  it('protectionManifestToDisplayText emits JSON for json format', () => {
    const text = protectionManifestToDisplayText(
      { metadata: { key: 'k' }, spec: { datasourceKey: 'ds' } },
      'json'
    );
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text).toContain('"datasourceKey"');
  });
});
