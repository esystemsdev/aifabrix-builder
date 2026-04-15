/**
 * Tests for External System Display Helpers
 *
 * @fileoverview Unit tests for external-system-display.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

// Mock logger with plain functions and call arrays (no jest.fn()) to avoid Jest ModuleMocker
// Symbol.hasInstance stack overflow when other suites (e.g. cli-utils.test.js) run in the same worker
const loggerCallArrays = { log: [], warn: [], error: [] };
jest.mock('../../../lib/utils/logger', () => ({
  log: (...args) => loggerCallArrays.log.push(args),
  warn: (...args) => loggerCallArrays.warn.push(args),
  error: (...args) => loggerCallArrays.error.push(args)
}));

const {
  displayTestResults,
  displayIntegrationTestResults,
  displayE2EResults
} = require('../../../lib/utils/external-system-display');

function expectLogCalled() {
  expect(loggerCallArrays.log.length).toBeGreaterThan(0);
}

function stripAnsi(s) {
  const esc = String.fromCharCode(0x1b);
  return String(s).replace(new RegExp(`${esc}\\[[0-9;]*m`, 'g'), '');
}

function expectLogContains(...substrings) {
  expectLogCalled();
  const logCalls = loggerCallArrays.log.map(args => stripAnsi(String(args[0])));
  for (const sub of substrings) {
    expect(logCalls.some(msg => msg.includes(sub))).toBe(true);
  }
}

describe('External System Display Helpers', () => {
  beforeEach(() => {
    loggerCallArrays.log.length = 0;
    loggerCallArrays.warn.length = 0;
    loggerCallArrays.error.length = 0;
  });

  describe('displayTestResults', () => {
    it('should use structured local validation report layout for passing run', () => {
      const results = {
        valid: true,
        systemKey: 'myapp',
        systemResults: [{ file: 'system.json', valid: true }],
        datasourceResults: [
          {
            key: 'datasource1',
            file: 'datasource1.json',
            valid: true,
            errors: [],
            warnings: []
          }
        ],
        errors: [],
        warnings: []
      };

      displayTestResults(results, false, 'myapp');
      expectLogContains('System: myapp', 'Run: test (local)', 'Data Quality:', 'Ready');
    });

    it('should show fail status when system file invalid', () => {
      const results = {
        valid: false,
        systemKey: 'x',
        systemResults: [{ file: 'system.json', valid: false, errors: ['schema mismatch'] }],
        datasourceResults: [],
        errors: [],
        warnings: []
      };

      displayTestResults(results, false, 'x');
      expectLogContains('FAIL', 'Failures:', 'schema mismatch');
    });

    it('should list datasource errors in verbose inventory', () => {
      const results = {
        valid: false,
        systemKey: 'x',
        systemResults: [],
        datasourceResults: [
          {
            key: 'datasource1',
            file: 'datasource1.json',
            valid: false,
            errors: ['Error 1', 'Error 2'],
            warnings: []
          }
        ],
        errors: [],
        warnings: []
      };

      displayTestResults(results, true, 'x');
      expectLogContains('Error 1', 'Error 2');
    });

    it('should show invalid metadata schema in verbose inventory', () => {
      const results = {
        valid: true,
        systemKey: 'x',
        systemResults: [],
        datasourceResults: [
          {
            key: 'datasource1',
            file: 'datasource1.json',
            valid: true,
            errors: [],
            warnings: [],
            metadataSchemaResults: { valid: false }
          }
        ],
        errors: [],
        warnings: []
      };

      displayTestResults(results, true, 'x');
      expectLogContains('Metadata schema: ✖ Invalid');
    });

    it('should surface top-level errors under Failures', () => {
      const results = {
        valid: false,
        systemKey: 'x',
        systemResults: [],
        datasourceResults: [],
        errors: ['Error 1', 'Error 2'],
        warnings: []
      };

      displayTestResults(results, false, 'x');
      expectLogContains('[manifest]', 'Error 1');
    });

    it('should list other warnings when present', () => {
      const results = {
        valid: true,
        systemKey: 'x',
        systemResults: [],
        datasourceResults: [],
        errors: [],
        warnings: ['Warning 1', 'Warning 2']
      };

      displayTestResults(results, false, 'x');
      expectLogContains('Other warnings:', 'Warning 1');
    });

    it('should handle empty system and datasource lists', () => {
      const results = {
        valid: true,
        systemKey: 'x',
        systemResults: [],
        datasourceResults: [],
        errors: [],
        warnings: []
      };

      displayTestResults(results, false, 'x');
      expectLogCalled();
    });
  });

  describe('displayIntegrationTestResults', () => {
    it('should display integration test results correctly', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true
          }
        ]
      };

      displayIntegrationTestResults(results, false);
      expectLogCalled();
    });

    it('should display no datasources tested message', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: []
      };

      displayIntegrationTestResults(results, false);
      expectLogContains('No datasources tested');
    });

    it('should display skipped datasources', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: true,
            reason: 'No test payload'
          }
        ]
      };

      displayIntegrationTestResults(results, false);
      expectLogContains('No test payload');
    });

    it('should display failed datasource with error', () => {
      const results = {
        success: false,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: false,
            error: 'Connection failed'
          }
        ]
      };

      displayIntegrationTestResults(results, false);
      expectLogContains('✖', 'Error: Connection failed');
    });

    it('should display failed integration tests message', () => {
      const results = {
        success: false,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: false,
            error: 'Connection failed'
          }
        ]
      };

      displayIntegrationTestResults(results, false);
      expectLogContains('✖ Some integration tests failed.');
    });

    it('should display verbose validation results when valid', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true,
              errors: [],
              warnings: []
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expectLogContains('Validation: ✔ Valid');
    });

    it('should display verbose validation results when invalid', () => {
      const results = {
        success: false,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: false,
            validationResults: {
              isValid: false,
              errors: ['Validation error 1', 'Validation error 2'],
              warnings: ['Warning 1']
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expectLogContains('Validation: ✖ Invalid', 'Validation error 1', 'Validation error 2', 'Warning 1');
    });

    it('should display verbose field mapping results', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true
            },
            fieldMappingResults: {
              mappingCount: 5,
              dimensions: { field1: 'metadata.field1', field2: 'metadata.field2', field3: 'metadata.field3' }
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expectLogContains('Field mappings: 5 attributes', 'Dimensions: field1, field2, field3');
    });

    it('should display verbose field mapping results without access fields', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true
            },
            fieldMappingResults: {
              mappingCount: 3
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expectLogContains('Field mappings: 3 attributes');
    });

    it('should display verbose endpoint test results when configured', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true
            },
            endpointTestResults: {
              endpointConfigured: true
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expectLogContains('Endpoint: ✔ Configured');
    });

    it('should display verbose endpoint test results when not configured', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true
            },
            endpointTestResults: {
              endpointConfigured: false
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expectLogContains('Endpoint: Not configured');
    });

    it('should display all verbose information together', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true,
              errors: [],
              warnings: ['Warning']
            },
            fieldMappingResults: {
              mappingCount: 10,
              dimensions: { field1: 'metadata.field1' }
            },
            endpointTestResults: {
              endpointConfigured: true
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expectLogContains('Validation: ✔ Valid', 'Field mappings: 10 attributes', 'Endpoint: ✔ Configured');
    });

    it('should use server DatasourceTestRun layout when envelope present', () => {
      const envelope = {
        datasourceKey: 'datasource1',
        systemKey: 'hubspot',
        runType: 'integration',
        status: 'ok',
        developer: { executiveSummary: 'ok' }
      };
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            datasourceTestRun: envelope
          }
        ]
      };

      displayIntegrationTestResults(results, false, { runType: 'integration' });
      expectLogContains('test-integration (dataplane)', 'Datasource: datasource1', 'All server tests passed.');
    });
  });

  describe('displayE2EResults', () => {
    it('should display sync response with data.steps only', () => {
      const data = {
        steps: [
          { name: 'config', success: true },
          { name: 'credential', success: true }
        ]
      };
      displayE2EResults(data, false);
      expectLogContains('✔ config', '✔ credential', '✔ E2E test passed.');
    });

    it('should display poll response with status and completedActions (running)', () => {
      const data = {
        status: 'running',
        completedActions: [{ name: 'config', success: true }]
      };
      displayE2EResults(data, true);
      expectLogContains('running', '✔ config', 'step(s) completed so far');
    });

    it('should display final poll response with status completed and steps', () => {
      const data = {
        status: 'completed',
        steps: [{ name: 'config', success: true }, { name: 'credential', success: true }],
        success: true
      };
      displayE2EResults(data, false);
      expectLogContains('completed', '✔ config', '✔ E2E test passed.');
    });

    it('should display failed E2E with status failed and error', () => {
      const data = {
        status: 'failed',
        success: false,
        error: 'Credential check failed'
      };
      displayE2EResults(data, false);
      expectLogContains('failed', 'Credential check failed', 'E2E test failed.');
    });

    it('should display step failure when a step has success false or error', () => {
      const data = {
        steps: [
          { name: 'config', success: true },
          { name: 'credential', success: false, error: 'Invalid token' }
        ]
      };
      displayE2EResults(data, false);
      expectLogContains('✖ credential', 'Invalid token', '✖ E2E test failed.');
    });

    it('should display sync step evidence (managed records) when verbose', () => {
      const data = {
        steps: [
          { name: 'config', success: true },
          {
            name: 'sync',
            success: true,
            evidence: {
              jobs: [
                {
                  recordsProcessed: 96,
                  totalRecords: 100,
                  audit: { inserted: 0, updated: 96, deleted: 0, totalProcessed: 96 }
                }
              ]
            }
          }
        ]
      };
      displayE2EResults(data, true);
      expectLogContains('✔ sync', 'Managed records', '96', 'updated: 96');
    });

    it('should display CIP execution trace count when verbose and auditLog present', () => {
      const data = {
        steps: [{ name: 'config', success: true }],
        auditLog: [
          { executionId: 'abc123-def456-ghi789' }
        ]
      };
      displayE2EResults(data, true);
      expectLogContains('CIP execution trace(s)', '1', 'executionId');
    });
  });
});
