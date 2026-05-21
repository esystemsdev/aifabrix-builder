'use strict';

const path = require('path');
const {
  existsSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync
} = require('../../../lib/internal/fs-real-sync');

/** Project-local workspace (not os.tmpdir) to avoid CI /tmp races between parallel Jest workers. */
function createProtectionTestWorkspace() {
  const root = path.join(__dirname, '../../../.temp/jest-protection-convert');
  mkdirSync(root, { recursive: true });
  const tmpRoot = mkdtempSync(path.join(root, 'run-'));
  const protectionDir = path.join(tmpRoot, '.protection');
  mkdirSync(protectionDir, { recursive: true });
  return { tmpRoot, protectionDir };
}

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
    ({ tmpRoot, protectionDir } = createProtectionTestWorkspace());
  });

  afterEach(() => {
    if (tmpRoot && existsSync(tmpRoot)) {
      try {
        rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
      } catch {
        /* best-effort */
      }
    }
  });

  it('listFilesNeedingConvert finds json when target is yaml', () => {
    const jsonPath = path.join(protectionDir, 'hubspot-companies.json');
    writeFileSync(jsonPath, '{"kind":"Protection"}');
    const files = listFilesNeedingConvert(protectionDir, 'yaml');
    expect(files).toEqual([jsonPath]);
  });

  it('runConvertProtectionBatch converts json to yaml with --force', async() => {
    const jsonPath = path.join(protectionDir, 'hubspot-companies.json');
    const asJson = JSON.stringify(require('js-yaml').load(readHubspotCompaniesYaml(__dirname)));
    writeFileSync(jsonPath, asJson);
    const { converted, deleted } = await runConvertProtectionBatch('yaml', {
      force: true,
      root: protectionDir
    });
    expect(converted.length).toBe(1);
    expect(converted[0]).toMatch(/hubspot-companies\.yaml$/);
    expect(existsSync(converted[0])).toBe(true);
    expect(deleted).toContain(jsonPath);
    expect(existsSync(jsonPath)).toBe(false);
  });

  it('returns empty when all files already match format', async() => {
    writeFileSync(
      path.join(protectionDir, 'hubspot-companies.yaml'),
      readHubspotCompaniesYaml(__dirname)
    );
    const result = await runConvertProtectionBatch('yaml', { force: true, root: protectionDir });
    expect(result.converted).toEqual([]);
    expect(result.deleted).toEqual([]);
  });
});
