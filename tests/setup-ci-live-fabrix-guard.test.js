/**
 * @fileoverview CI_SIMULATION must not disable live ~/.aifabrix write protection in setup.js.
 * Runs in isolated Jest project `setup-ci-live-fabrix-guard` (see jest.projects.js).
 */

'use strict';

const fs = require('fs');

describe('setup.js live Fabrix guard under CI_SIMULATION', () => {
  it('blocks fs.writeFileSync to live secrets when CI and CI_SIMULATION are set', () => {
    expect(() => fs.writeFileSync('/workspace/.aifabrix/secrets.local.yaml', '{}\n', 'utf8')).toThrow(
      /Refusing to write secrets/
    );
  });
});
