/**
 * @fileoverview Tests for datasource-test-run-legacy-adapter
 */

const {
  integrationResultFromEnvelope,
  e2eShapeFromEnvelope,
  firstIssueMessage
} = require('../../../lib/utils/datasource-test-run-legacy-adapter');

describe('datasource-test-run-legacy-adapter', () => {
  describe('integrationResultFromEnvelope', () => {
    it('returns failure when envelope is null', () => {
      const r = integrationResultFromEnvelope(null, 'ds1');
      expect(r.success).toBe(false);
      expect(r.key).toBe('ds1');
      expect(r.error).toMatch(/No report/);
    });

    it('maps pass status to success', () => {
      const r = integrationResultFromEnvelope(
        { status: 'pass', systemKey: 'sys-a', validation: { issues: [] } },
        'ds1'
      );
      expect(r.success).toBe(true);
      expect(r.systemKey).toBe('sys-a');
      expect(r.error).toBeUndefined();
    });

    it('maps fail status and first validation issue', () => {
      const r = integrationResultFromEnvelope(
        {
          status: 'fail',
          validation: { issues: [{ message: 'bad thing' }] }
        },
        'ds1'
      );
      expect(r.success).toBe(false);
      expect(r.error).toBe('bad thing');
    });
  });

  describe('e2eShapeFromEnvelope', () => {
    it('maps integration.stepResults to steps', () => {
      const shape = e2eShapeFromEnvelope({
        status: 'pass',
        integration: {
          stepResults: [
            { name: 'config', success: true },
            { name: 'credential', success: false, message: 'nope' }
          ]
        }
      });
      expect(shape.steps).toHaveLength(2);
      expect(shape.steps[0].name).toBe('config');
      expect(shape.steps[1].success).toBe(false);
      expect(shape.success).toBe(true);
    });
  });

  describe('firstIssueMessage', () => {
    it('prefers validation issues', () => {
      expect(
        firstIssueMessage({
          validation: { issues: [{ hint: 'use tls' }] },
          integration: { stepResults: [{ success: false, message: 'step' }] }
        })
      ).toBe('use tls');
    });
  });
});
