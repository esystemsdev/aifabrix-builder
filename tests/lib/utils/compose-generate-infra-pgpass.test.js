/**
 * @fileoverview resolveInfraPgpassPath (system dir vs legacy home)
 */

const path = require('path');
const { resolveInfraPgpassPath } = require('../../../lib/utils/compose-generate-docker-compose');

describe('resolveInfraPgpassPath', () => {
  it('returns system path when pgpass exists under getAifabrixSystemDir', () => {
    const sys = path.join('/sys', '.aifabrix', 'infra', 'pgpass');
    const exists = jest.fn((p) => p === sys);
    const pathsUtil = {
      getAifabrixSystemDir: () => path.join('/sys', '.aifabrix'),
      getAifabrixHome: () => '/home/user'
    };
    expect(resolveInfraPgpassPath(0, pathsUtil, exists)).toBe(sys);
    expect(exists).toHaveBeenCalledWith(sys);
  });

  it('returns legacy path when system pgpass missing, bases differ, legacy file exists', () => {
    const sys = path.join('/sys', '.aifabrix', 'infra', 'pgpass');
    const leg = path.join('/home', 'user', 'infra', 'pgpass');
    const exists = jest.fn((p) => p === leg);
    const pathsUtil = {
      getAifabrixSystemDir: () => path.join('/sys', '.aifabrix'),
      getAifabrixHome: () => path.join('/home', 'user')
    };
    expect(resolveInfraPgpassPath(0, pathsUtil, exists)).toBe(leg);
  });

  it('returns system candidate when home equals system even if file missing', () => {
    const base = path.join('/same', '.aifabrix');
    const expected = path.join(base, 'infra', 'pgpass');
    const exists = jest.fn(() => false);
    const pathsUtil = {
      getAifabrixSystemDir: () => base,
      getAifabrixHome: () => base
    };
    expect(resolveInfraPgpassPath(0, pathsUtil, exists)).toBe(expected);
  });

  it('uses infra-dev{n} directory for non-zero dev id', () => {
    const base = '/x/.aifabrix';
    const expected = path.join(base, 'infra-dev3', 'pgpass');
    const exists = jest.fn((p) => p === expected);
    const pathsUtil = {
      getAifabrixSystemDir: () => base,
      getAifabrixHome: () => '/y'
    };
    expect(resolveInfraPgpassPath(3, pathsUtil, exists)).toBe(expected);
  });
});
