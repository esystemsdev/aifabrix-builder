/**
 * @fileoverview Tests for runProtectionList (protection list command).
 */

'use strict';

jest.mock('chalk', () => {
  const mock = (t) => t;
  mock.red = (t) => t;
  mock.gray = (t) => t;
  mock.green = (t) => t;
  mock.yellow = (t) => t;
  mock.bold = (t) => t;
  mock.cyan = (t) => t;
  return mock;
});

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('../../../lib/protection/auth-context', () => ({
  resolveProtectionDataplaneContext: jest.fn()
}));

jest.mock('../../../lib/api/protection.api', () => {
  const actual = jest.requireActual('../../../lib/api/protection.api');
  return {
    ...actual,
    listProtectionManifests: jest.fn()
  };
});

const { resolveProtectionDataplaneContext } = require('../../../lib/protection/auth-context');
const { listProtectionManifests } = require('../../../lib/api/protection.api');
const { runProtectionList } = require('../../../lib/protection/run-commands');

describe('runProtectionList', () => {
  const logger = { log: jest.fn(), error: jest.fn() };
  const ctx = {
    environment: 'dev',
    controllerUrl: 'http://localhost:3600',
    dataplaneUrl: 'http://localhost:3201',
    authConfig: { type: 'bearer', token: 'tok' }
  };

  let stdoutSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    resolveProtectionDataplaneContext.mockResolvedValue(ctx);
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('writes paginated JSON to stdout when --json', async() => {
    const raw = {
      data: [{ key: 'p1', datasourceKey: 'hubspot-companies', enabled: true }],
      meta: { totalItems: 1, currentPage: 1, pageSize: 20 }
    };
    listProtectionManifests.mockResolvedValue({
      items: raw.data,
      meta: raw.meta,
      raw
    });

    const code = await runProtectionList(
      { json: true, page: 1, pageSize: 20, filter: 'enabled:eq:true' },
      logger
    );

    expect(code).toBe(0);
    expect(listProtectionManifests).toHaveBeenCalledWith(ctx.dataplaneUrl, ctx.authConfig, {
      page: 1,
      pageSize: 20,
      filter: 'enabled:eq:true'
    });
    expect(stdoutSpy).toHaveBeenCalled();
    const written = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    const parsed = JSON.parse(written.trim());
    expect(parsed.data).toHaveLength(1);
    expect(parsed.meta.totalItems).toBe(1);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('logs TTY card list via formatProtectionListTTY when not json', async() => {
    listProtectionManifests.mockResolvedValue({
      items: [
        {
          key: 'hubspot-prot',
          datasourceKey: 'hubspot-companies',
          displayName: 'HubSpot',
          enabled: true,
          currentRevision: 1
        }
      ],
      meta: { totalItems: 1, currentPage: 1, pageSize: 20 },
      raw: {}
    });

    const code = await runProtectionList({}, logger);

    expect(code).toBe(0);
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledTimes(1);
    const text = String(logger.log.mock.calls[0][0]);
    expect(text).toContain('hubspot-companies');
    expect(text).toContain('Protection manifests in dev');
  });

  it('omits invalid page params from API call', async() => {
    listProtectionManifests.mockResolvedValue({ items: [], meta: null, raw: {} });

    await runProtectionList({ page: Number.NaN, pageSize: undefined }, logger);

    expect(listProtectionManifests).toHaveBeenCalledWith(ctx.dataplaneUrl, ctx.authConfig, {});
  });
});
