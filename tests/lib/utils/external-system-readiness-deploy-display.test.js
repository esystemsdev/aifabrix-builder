/**
 * @fileoverview Tests for readiness deploy display (config/deployment/runtime layers).
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

const logger = require('../../../lib/utils/logger');
const { logDeployReadinessSummary } = require('../../../lib/utils/external-system-readiness-deploy-display');

function stripAnsi(s) {
  const ESC = String.fromCharCode(27);
  const re = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
  return String(s).replace(re, '');
}

function joined() {
  return logger.log.mock.calls.map(c => stripAnsi(String(c[0]))).join('\n');
}

describe('external-system-readiness-deploy-display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prints layered config/deployment/runtime sections without probe', () => {
    logDeployReadinessSummary({
      environment: 'dev',
      dataplaneUrl: 'http://localhost:3111',
      manifest: {
        key: 'hubspot',
        system: { authentication: { method: 'apikey' }, generateMcpContract: true },
        dataSources: [{ key: 'contacts', status: 'published', isActive: true }]
      },
      datasources: [{ key: 'contacts', status: 'published', isActive: true, mcpContract: {} }],
      systemFromDataplane: { openApiDocsPageUrl: 'http://docs' },
      fetchError: null,
      deploymentOk: true,
      deploymentDetail: null,
      probeData: null
    });

    const out = joined();
    expect(out).toContain('Environment: dev');
    expect(out).toContain('Dataplane: http://localhost:3111');
    expect(out).toContain('System Readiness:');
    expect(out).toContain('Config:');
    expect(out).toContain('Deployment:');
    expect(out).toContain('Runtime:');
    expect(out).toContain('Skipped (use --probe to verify)');
    expect(out).toContain('Datasources:');
  });

  it('prints dataplane fetch warning when fetchError present', () => {
    logDeployReadinessSummary({
      environment: 'dev',
      dataplaneUrl: 'http://localhost:3111',
      manifest: { key: 'hubspot', system: {} },
      datasources: [],
      systemFromDataplane: null,
      fetchError: new Error('connection refused'),
      deploymentOk: true,
      deploymentDetail: null,
      probeData: null
    });

    const out = joined();
    expect(out).toContain('Unable to fetch system details from dataplane');
    expect(out).toContain('Deployment succeeded, but readiness could not be verified.');
  });
});

