/**
 * @fileoverview Commander: run registers --proxy (default true), --no-proxy, and isRunCliNoProxy(opts)
 */

'use strict';

const { Command } = require('commander');
const { isRunCliNoProxy } = require('../../../lib/utils/run-cli-flags');

describe('run command proxy flags (Commander)', () => {
  function buildRunProgram() {
    const program = new Command();
    program
      .command('run <app>')
      .option(
        '--proxy',
        'Use Traefik/front-door public URL hints when infra has Traefik and application.yaml enables frontDoorRouting (default: on)',
        true
      )
      .option(
        '--no-proxy',
        'Use localhost for health/summary URLs only (dev; saves applications.<app>.proxy: false); overrides --proxy'
      )
      .action(() => {});
    return program;
  }

  it('defaults proxy true when flag omitted', () => {
    const p = buildRunProgram();
    p.parse(['run', 'miso-controller'], { from: 'user' });
    const cmd = p.commands.find((c) => c.name() === 'run');
    expect(cmd.opts().proxy).toBe(true);
    expect(cmd.opts().noProxy).toBeUndefined();
  });

  it('treats --no-proxy as localhost-only run (isRunCliNoProxy)', () => {
    const p = buildRunProgram();
    p.parse(['run', 'miso-controller', '--no-proxy'], { from: 'user' });
    const cmd = p.commands.find((c) => c.name() === 'run');
    expect(isRunCliNoProxy(cmd.opts())).toBe(true);
  });
});
