/**
 * @fileoverview Tests for governance scenario pack loader
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const {
  resolveGovernancePackPath,
  loadGovernancePackYaml
} = require('../../../lib/governance/governance-pack-loader');

describe('governance-pack-loader', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-pack-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads yaml pack document', () => {
    const packPath = path.join(tmpDir, 'pack.yaml');
    const doc = {
      apiVersion: 'dataplane.aifabrix.ai/v1',
      kind: 'GovernanceScenarioPack',
      metadata: { key: 't', displayName: 'T' },
      spec: { systemKey: 'sys', scenarios: [] }
    };
    const body = yaml.dump(doc);
    fs.writeFileSync(packPath, body, 'utf8');
    expect(fs.readFileSync(packPath, 'utf8').length).toBeGreaterThan(0);
    expect(loadGovernancePackYaml(packPath)).toMatchObject({ kind: 'GovernanceScenarioPack' });
  });

  it('resolves default pack path under integration', () => {
    const scenariosDir = path.join(tmpDir, 'scenarios');
    fs.mkdirSync(scenariosDir, { recursive: true });
    const packFile = path.join(scenariosDir, 'my-sys-v1.yaml');
    fs.writeFileSync(
      packFile,
      yaml.dump({
        apiVersion: 'dataplane.aifabrix.ai/v1',
        kind: 'GovernanceScenarioPack',
        metadata: { key: 'my-sys-v1', displayName: 'My Sys' },
        spec: { systemKey: 'my-sys', scenarios: [] }
      }),
      'utf8'
    );
    expect(fs.existsSync(packFile)).toBe(true);
    const resolved = resolveGovernancePackPath('my-sys', { app: tmpDir });
    expect(resolved).toBe(packFile);
  });

  it('throws when pack file missing', () => {
    expect(() => resolveGovernancePackPath('missing', { app: tmpDir })).toThrow(
      /No scenario pack found/
    );
  });
});
