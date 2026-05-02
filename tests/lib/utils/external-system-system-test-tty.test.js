/**
 * @fileoverview System-level (§17) TTY renderer tests for aggregated DatasourceTestRun results.
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const {
  displaySystemAggregateDatasourceTestRuns
} = require('../../../lib/utils/external-system-system-test-tty');

function stripAnsi(s) {
  const esc = String.fromCharCode(27);
  return String(s).replace(new RegExp(`${esc}\\[[0-9;]*m`, 'g'), '');
}

function joinedLogs() {
  return logger.log.mock.calls.map(c => stripAnsi(c[0] ?? '')).join('\n');
}

describe('displaySystemAggregateDatasourceTestRuns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders system overview without dumping full per-datasource §16 blocks', () => {
    const results = {
      systemKey: 'hubspot',
      success: false,
      datasourceResults: [
        {
          key: 'hubspot.contacts',
          skipped: false,
          success: true,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 'hubspot.contacts',
            systemKey: 'hubspot',
            runType: 'integration',
            status: 'ok',
            validation: { status: 'ok', dataReadiness: 'ready' },
            certificate: { status: 'passed', level: 'bronze' }
          }
        },
        {
          key: 'hubspot.companies',
          skipped: false,
          success: true,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 'hubspot.companies',
            systemKey: 'hubspot',
            runType: 'integration',
            status: 'warn',
            validation: {
              status: 'warn',
              dataReadiness: 'partial',
              issues: [{ severity: 'warning', message: 'inconsistent ownerId mapping' }]
            },
            certificate: { status: 'passed', level: 'bronze' }
          }
        },
        {
          key: 'hubspot.deals',
          skipped: false,
          success: false,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 'hubspot.deals',
            systemKey: 'hubspot',
            runType: 'integration',
            status: 'fail',
            validation: {
              status: 'fail',
              dataReadiness: 'not_ready',
              issues: [{ severity: 'error', message: 'deal.create failing (permission missing)' }]
            },
            certificate: { status: 'not_passed', level: 'bronze' }
          }
        }
      ]
    };

    displaySystemAggregateDatasourceTestRuns(results, { runType: 'integration', verbose: false });

    const out = joinedLogs();
    expect(out).toContain('System:');
    expect(out).toContain('hubspot');
    expect(out).toContain('Verdict:');
    expect(out).toContain('Data Quality:');
    expect(out).toContain('Datasources:');
    expect(out).toContain('Blocking datasource: hubspot.deals');
    expect(out).toContain('Key issues:');
    expect(out).toContain('Integration health:');
    expect(out).toContain('Certification:');
    expect(out).toContain('Use:');
    expect(out).toContain('aifabrix datasource test-integration hubspot.deals');

    // System view must not print a full per-datasource DatasourceTestRun TTY header ("Datasource: x (system)").
    expect(out).not.toMatch(/Datasource:\\s+hubspot\\./);

    // Collapsed view should not list OK datasource rows in the Datasources table (it should summarize them).
    expect(out).toContain('✔ 1 datasource(s) fully ready');
    expect(out).not.toContain('✔ hubspot.contacts');
  });

  it('prefers datasourceKey for blocking drill-down when row.key differs', () => {
    const results = {
      systemKey: 'x',
      success: false,
      datasourceResults: [
        {
          key: 'alias-key',
          skipped: false,
          success: false,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 'real.ds',
            systemKey: 'x',
            runType: 'integration',
            status: 'fail',
            validation: { status: 'fail', dataReadiness: 'not_ready' }
          }
        }
      ]
    };
    displaySystemAggregateDatasourceTestRuns(results, { runType: 'integration', verbose: false });
    const out = joinedLogs();
    expect(out).toContain('Blocking datasource: real.ds');
    expect(out).toContain('aifabrix datasource test-integration real.ds');
  });

  it('prints capabilities overview when envelopes include capabilities', () => {
    const results = {
      systemKey: 's',
      success: true,
      datasourceResults: [
        {
          key: 's.a',
          skipped: false,
          success: true,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 's.a',
            systemKey: 's',
            runType: 'e2e',
            status: 'ok',
            validation: { status: 'ok', dataReadiness: 'ready' },
            capabilities: [
              { key: 'read', status: 'ok' },
              { key: 'create', status: 'ok' }
            ]
          }
        }
      ]
    };
    displaySystemAggregateDatasourceTestRuns(results, { runType: 'e2e', verbose: false });
    const out = joinedLogs();
    expect(out).toContain('Capabilities overview:');
    expect(out).toContain('s.a:');
    expect(out).toContain('✔ read');
    expect(out).toContain('✔ create');
  });

  it('integration health expands up to two failed steps', () => {
    const results = {
      systemKey: 's',
      success: false,
      datasourceResults: [
        {
          key: 's.a',
          skipped: false,
          success: false,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 's.a',
            systemKey: 's',
            runType: 'integration',
            status: 'fail',
            validation: { status: 'fail', dataReadiness: 'not_ready' },
            integration: {
              status: 'fail',
              stepResults: [
                { name: 'fetch', success: false, error: 'timeout' },
                { name: 'map', success: false, message: 'bad field' },
                { name: 'extra', success: false, error: 'hidden' }
              ]
            }
          }
        }
      ]
    };
    displaySystemAggregateDatasourceTestRuns(results, { runType: 'integration', verbose: false });
    const out = joinedLogs();
    expect(out).toContain('Integration health:');
    expect(out).toContain('s.a:');
    expect(out).toContain('fetch: timeout');
    expect(out).toContain('map: bad field');
    expect(out).not.toContain('extra:');
  });

  it('system aggregate TTY matches snapshot (integration, single ok row)', () => {
    const results = {
      systemKey: 'snap-sys',
      success: true,
      datasourceResults: [
        {
          key: 'snap-sys.a',
          skipped: false,
          success: true,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 'snap-sys.a',
            systemKey: 'snap-sys',
            runType: 'integration',
            status: 'ok',
            validation: { status: 'ok', dataReadiness: 'ready' },
            certificate: { status: 'passed', level: 'bronze' }
          }
        }
      ]
    };
    displaySystemAggregateDatasourceTestRuns(results, { runType: 'integration', verbose: false });
    expect(joinedLogs()).toMatchSnapshot();
  });

  it('does not print Blocking datasource line when every row is ok', () => {
    const results = {
      systemKey: 'all-green',
      success: true,
      datasourceResults: [
        {
          key: 'all-green.a',
          skipped: false,
          success: true,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 'all-green.a',
            systemKey: 'all-green',
            runType: 'e2e',
            status: 'ok',
            validation: { status: 'ok', dataReadiness: 'ready' }
          }
        },
        {
          key: 'all-green.b',
          skipped: false,
          success: true,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 'all-green.b',
            systemKey: 'all-green',
            runType: 'e2e',
            status: 'ok',
            validation: { status: 'ok', dataReadiness: 'ready' }
          }
        }
      ]
    };
    displaySystemAggregateDatasourceTestRuns(results, { runType: 'e2e', verbose: false });
    const out = joinedLogs();
    expect(out).not.toContain('Blocking datasource:');
    expect(out).toContain('Use:');
    expect(out).toContain('aifabrix datasource test-e2e all-green.a');
  });

  it('verbose mode lists all datasources including ok rows', () => {
    const results = {
      systemKey: 's',
      success: true,
      datasourceResults: [
        {
          key: 's.a',
          skipped: false,
          success: true,
          datasourceTestRun: {
            reportVersion: '1.1.0',
            datasourceKey: 's.a',
            systemKey: 's',
            runType: 'e2e',
            status: 'ok',
            validation: { status: 'ok', dataReadiness: 'ready' }
          }
        }
      ]
    };
    displaySystemAggregateDatasourceTestRuns(results, { runType: 'e2e', verbose: true });
    const out = joinedLogs();
    expect(out).toContain('s.a');
    expect(out).not.toContain('✔ 1 datasource(s) fully ready');
  });
});

