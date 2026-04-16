/**
 * @fileoverview resolveInfraStatePaths — system dir vs legacy aifabrix-home layouts
 */

jest.unmock('fs');

const fs = require('fs');
const path = require('path');
const os = require('os');

const helpers = require('../../../lib/infrastructure/helpers');
const pathsUtil = require('../../../lib/utils/paths');

describe('resolveInfraStatePaths', () => {
  let tmpSystem;
  let tmpLegacy;

  beforeEach(() => {
    tmpSystem = fs.mkdtempSync(path.join(os.tmpdir(), 'aifx-ris-sys-'));
    tmpLegacy = fs.mkdtempSync(path.join(os.tmpdir(), 'aifx-ris-leg-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      fs.rmSync(tmpSystem, { recursive: true, force: true });
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tmpLegacy, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('uses system infra directory when compose.yaml exists under getAifabrixSystemDir', () => {
    jest.spyOn(pathsUtil, 'getAifabrixSystemDir').mockReturnValue(tmpSystem);
    jest.spyOn(pathsUtil, 'getAifabrixHome').mockReturnValue(tmpLegacy);

    const infraDir = path.join(tmpSystem, 'infra');
    fs.mkdirSync(infraDir, { recursive: true });
    fs.writeFileSync(path.join(infraDir, 'compose.yaml'), 'services: {}\n');

    const r = helpers.resolveInfraStatePaths(0);
    expect(r.infraDir).toBe(infraDir);
    expect(r.adminSecretsPath).toBe(path.join(tmpSystem, 'admin-secrets.env'));
  });

  it('falls back to legacy home infra when compose exists only under getAifabrixHome', () => {
    jest.spyOn(pathsUtil, 'getAifabrixSystemDir').mockReturnValue(tmpSystem);
    jest.spyOn(pathsUtil, 'getAifabrixHome').mockReturnValue(tmpLegacy);

    const legInfra = path.join(tmpLegacy, 'infra');
    fs.mkdirSync(legInfra, { recursive: true });
    fs.writeFileSync(path.join(legInfra, 'compose.yaml'), 'services: {}\n');

    const r = helpers.resolveInfraStatePaths(0);
    expect(r.infraDir).toBe(legInfra);
    expect(r.adminSecretsPath).toBe(path.join(tmpSystem, 'admin-secrets.env'));
  });

  it('uses legacy admin-secrets.env when system file is missing and legacy exists', () => {
    jest.spyOn(pathsUtil, 'getAifabrixSystemDir').mockReturnValue(tmpSystem);
    jest.spyOn(pathsUtil, 'getAifabrixHome').mockReturnValue(tmpLegacy);

    const sysInfra = path.join(tmpSystem, 'infra');
    fs.mkdirSync(sysInfra, { recursive: true });
    fs.writeFileSync(path.join(sysInfra, 'compose.yaml'), 'x: 1\n');
    fs.writeFileSync(path.join(tmpLegacy, 'admin-secrets.env'), 'POSTGRES_PASSWORD=x\n');

    const r = helpers.resolveInfraStatePaths(0);
    expect(r.infraDir).toBe(sysInfra);
    expect(r.adminSecretsPath).toBe(path.join(tmpLegacy, 'admin-secrets.env'));
  });

  it('uses infra-dev{id} for non-zero developer id', () => {
    jest.spyOn(pathsUtil, 'getAifabrixSystemDir').mockReturnValue(tmpSystem);
    jest.spyOn(pathsUtil, 'getAifabrixHome').mockReturnValue(tmpLegacy);

    const infraDir = path.join(tmpSystem, 'infra-dev2');
    fs.mkdirSync(infraDir, { recursive: true });
    fs.writeFileSync(path.join(infraDir, 'compose.yaml'), 'x: 1\n');

    const r = helpers.resolveInfraStatePaths(2);
    expect(r.infraDir).toBe(infraDir);
    expect(r.adminSecretsPath).toBe(path.join(tmpSystem, 'admin-secrets.env'));
  });
});
