'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../lib/commands/convert', () => ({
  promptConfirm: jest.fn().mockResolvedValue(true),
  targetFileName: jest.requireActual('../../../lib/commands/convert').targetFileName,
  convertOneFile: jest.requireActual('../../../lib/commands/convert').convertOneFile
}));

const {
  listFilesNeedingConvert,
  runConvertProtectionBatch
} = require('../../../lib/protection/convert-batch');
const { readHubspotCompaniesYaml } = require('./protection-test-fixtures');

describe('protection convert-batch', () => {
  let tmpRoot;
  let protectionDir;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prot-convert-'));
    protectionDir = path.join(tmpRoot, '.protection');
    fs.mkdirSync(protectionDir, { recursive: true });
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

  it('listFilesNeedingConvert finds json when target is yaml', () => {
    const jsonPath = path.join(protectionDir, 'hubspot-companies.json');
    fs.writeFileSync(jsonPath, '{"kind":"Protection"}');
    const files = listFilesNeedingConvert(protectionDir, 'yaml');
    expect(files).toEqual([jsonPath]);
  });

  it('runConvertProtectionBatch converts json to yaml with --force', async() => {
    const jsonPath = path.join(protectionDir, 'hubspot-companies.json');
    const asJson = JSON.stringify(require('js-yaml').load(readHubspotCompaniesYaml(__dirname)));
    fs.writeFileSync(jsonPath, asJson);
    const { converted, deleted } = await runConvertProtectionBatch('yaml', {
      force: true,
      root: protectionDir
    });
    expect(converted.length).toBe(1);
    expect(converted[0]).toMatch(/hubspot-companies\.yaml$/);
    expect(fs.existsSync(converted[0])).toBe(true);
    expect(deleted).toContain(jsonPath);
    expect(fs.existsSync(jsonPath)).toBe(false);
  });

  it('returns empty when all files already match format', async() => {
    fs.writeFileSync(
      path.join(protectionDir, 'hubspot-companies.yaml'),
      readHubspotCompaniesYaml(__dirname)
    );
    const result = await runConvertProtectionBatch('yaml', { force: true, root: protectionDir });
    expect(result.converted).toEqual([]);
    expect(result.deleted).toEqual([]);
  });
});
