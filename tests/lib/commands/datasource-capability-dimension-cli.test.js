jest.mock('../../../lib/datasource/capability/run-capability-dimension', () => ({
  runCapabilityDimension: jest.fn()
}));

const { runCapabilityDimension } = require('../../../lib/datasource/capability/run-capability-dimension');
const { runDimensionAction } = require('../../../lib/commands/datasource-capability-dimension-cli');

describe('datasource capability dimension CLI', () => {
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (logSpy) logSpy.mockRestore();
  });

  it('passes options through to runner (local)', async() => {
    runCapabilityDimension.mockResolvedValue({
      dryRun: true,
      patchOperations: [{ op: 'add', path: '/dimensions/market', value: { type: 'local', field: 'country' } }]
    });

    await runDimensionAction('test-ds', {
      dimension: 'market',
      type: 'local',
      field: 'country',
      via: [],
      dryRun: true,
      noBackup: false,
      overwrite: false
    });

    expect(runCapabilityDimension).toHaveBeenCalledWith(
      expect.objectContaining({
        fileOrKey: 'test-ds',
        dimension: 'market',
        type: 'local',
        field: 'country',
        via: []
      })
    );
  });

  it('normalizes via array and passes to runner (fk)', async() => {
    runCapabilityDimension.mockResolvedValue({
      dryRun: true,
      patchOperations: []
    });

    await runDimensionAction('test-ds', {
      dimension: 'owner',
      type: 'fk',
      via: ['hubspotOwner:owner', ' primaryCompany:market '],
      actor: 'email',
      operator: 'eq',
      dryRun: true
    });

    expect(runCapabilityDimension).toHaveBeenCalledWith(
      expect.objectContaining({
        via: ['hubspotOwner:owner', 'primaryCompany:market'],
        actor: 'email',
        operator: 'eq'
      })
    );
  });
});

