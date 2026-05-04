/**
 * @fileoverview Tests for E2E certificate issuance hint aggregation (cert sync UX).
 */

'use strict';

const { firstIssuanceFailureHintFromE2eResults } = require('../../../lib/cli/setup-app.test-commands');

describe('firstIssuanceFailureHintFromE2eResults', () => {
  it('returns null when no failed issuance', () => {
    expect(
      firstIssuanceFailureHintFromE2eResults([
        {
          key: 'a',
          datasourceTestRun: { certificateIssuance: { status: 'issued' } }
        }
      ])
    ).toBeNull();
  });

  it('prefixes single failed row with datasource key', () => {
    const hint = firstIssuanceFailureHintFromE2eResults([
      {
        key: 'sys.users',
        datasourceTestRun: {
          certificateIssuance: {
            status: 'failed',
            reasonCode: 'SIGNING_NOT_CONFIGURED',
            message: 'no keys'
          }
        }
      }
    ]);
    expect(hint).toBe('[sys.users] SIGNING_NOT_CONFIGURED: no keys');
  });

  it('dedupes hint when every row failed with the same reasonCode', () => {
    const hint = firstIssuanceFailureHintFromE2eResults([
      {
        key: 'sys.users',
        datasourceTestRun: {
          certificateIssuance: {
            status: 'failed',
            reasonCode: 'CERTIFICATION_NOT_PASSED',
            message: 'Certification did not pass'
          }
        }
      },
      {
        key: 'sys.deals',
        datasourceTestRun: {
          certificateIssuance: {
            status: 'failed',
            reasonCode: 'CERTIFICATION_NOT_PASSED',
            message: 'Certification did not pass'
          }
        }
      }
    ]);
    expect(hint).toContain('CERTIFICATION_NOT_PASSED');
    expect(hint).toContain('2 datasource scopes');
    expect(hint).toContain('first: sys.users');
    expect(hint).not.toMatch(/^\[sys\.users\]/);
  });
});
