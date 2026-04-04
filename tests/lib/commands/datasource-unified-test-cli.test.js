/**
 * @fileoverview Tests for datasource-unified-test-cli.js (watch flags registration).
 */

const { attachDatasourceWatchOptions } = require('../../../lib/commands/datasource-unified-test-cli');

describe('datasource-unified-test-cli', () => {
  it('attachDatasourceWatchOptions registers watch-related flags', () => {
    const cmd = { option: jest.fn().mockReturnThis() };
    attachDatasourceWatchOptions(cmd);
    expect(cmd.option).toHaveBeenCalledWith('--watch', expect.any(String));
    expect(cmd.option).toHaveBeenCalledWith(
      '--watch-path <path>',
      expect.any(String),
      expect.any(Function),
      []
    );
    expect(cmd.option).toHaveBeenCalledWith('--watch-application-yaml', expect.any(String));
    expect(cmd.option).toHaveBeenCalledWith('--watch-ci', expect.any(String));
    expect(cmd.option).toHaveBeenCalledWith('--watch-full-diff', expect.any(String));
  });

  it('watch-path collector accumulates repeated flags', () => {
    const cmd = { option: jest.fn().mockReturnThis() };
    attachDatasourceWatchOptions(cmd);
    const watchPathCall = cmd.option.mock.calls.find(c => c[0] === '--watch-path <path>');
    expect(watchPathCall).toBeDefined();
    const collect = watchPathCall[2];
    expect(collect('a', [])).toEqual(['a']);
    expect(collect('b', ['a'])).toEqual(['a', 'b']);
  });
});
