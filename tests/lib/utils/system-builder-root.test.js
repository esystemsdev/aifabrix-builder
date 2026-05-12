/**
 * @fileoverview resolveSystemBuilderParentDir (config dir vs aifabrix-home)
 */

'use strict';

const path = require('path');
const { resolveSystemBuilderParentDir } = require('../../../lib/utils/system-builder-root');

describe('resolveSystemBuilderParentDir', () => {
  it('uses systemDir when it equals homeDir', () => {
    const base = path.resolve('/x/.aifabrix');
    expect(resolveSystemBuilderParentDir(base, base)).toBe(base);
  });

  it('uses systemDir when config is nested under home (builder-server layout)', () => {
    const home = path.resolve('/home/user');
    const system = path.resolve('/home/user/.aifabrix');
    expect(resolveSystemBuilderParentDir(system, home)).toBe(system);
  });

  it('uses homeDir when config dir is outside resolved home (aifabrix-home override)', () => {
    const home = path.resolve('/data/aifabrix-root');
    const system = path.resolve('/home/dev/.aifabrix');
    expect(resolveSystemBuilderParentDir(system, home)).toBe(home);
  });

  it('uses homeDir when config path only shares a name prefix with home (not nested)', () => {
    const home = path.resolve('/var/aifabrix');
    const system = path.resolve('/var/aifabrix-config');
    expect(resolveSystemBuilderParentDir(system, home)).toBe(home);
  });
});
