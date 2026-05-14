/**
 * @fileoverview setup-prompts — absolute platform REPLACE paths (plan 141 P0b)
 */

'use strict';

const path = require('path');
const { formatBuilderPlatformReplaceLines } = require('../../../lib/commands/setup-prompts');

describe('formatBuilderPlatformReplaceLines', () => {
  it('returns absolute paths with trailing separator', () => {
    const root = path.resolve('/work', 'builder');
    const lines = formatBuilderPlatformReplaceLines(root, ['keycloak', 'miso-controller']);
    expect(lines[0]).toMatch(/keycloak[/\\]$/);
    expect(lines[1]).toMatch(/miso-controller[/\\]$/);
    expect(path.isAbsolute(lines[0])).toBe(true);
  });

  it('resolves relative builderRoot against cwd', () => {
    const lines = formatBuilderPlatformReplaceLines('builder', ['dataplane']);
    expect(lines[0]).toBe(`${path.resolve('builder', 'dataplane')}${path.sep}`);
  });
});
