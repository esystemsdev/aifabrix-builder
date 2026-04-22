/**
 * @fileoverview Tests for controller deployment outcome parsing
 */

'use strict';

const { parseControllerDeploymentOutcome } = require('../../../lib/utils/controller-deployment-outcome');

describe('parseControllerDeploymentOutcome', () => {
  it('treats missing status block as ok (e.g. poll disabled)', () => {
    expect(parseControllerDeploymentOutcome({ deploymentId: 'x' })).toEqual({
      ok: true,
      statusLabel: null,
      message: null,
      error: null
    });
  });

  it('treats completed as ok', () => {
    expect(
      parseControllerDeploymentOutcome({
        deploymentId: 'x',
        status: { id: 'x', status: 'completed', progress: 100 }
      })
    ).toMatchObject({ ok: true, statusLabel: 'completed' });
  });

  it('treats failed as not ok and preserves message and error', () => {
    const o = parseControllerDeploymentOutcome({
      status: {
        status: 'failed',
        message: 'Rollout timeout',
        error: 'Pod crash'
      }
    });
    expect(o.ok).toBe(false);
    expect(o.statusLabel).toBe('failed');
    expect(o.message).toBe('Rollout timeout');
    expect(o.error).toBe('Pod crash');
  });

  it('reads deploymentStatus when status is not a string', () => {
    expect(
      parseControllerDeploymentOutcome({
        status: { deploymentStatus: 'completed' }
      })
    ).toMatchObject({ ok: true, statusLabel: 'completed' });
  });

  it('normalizes error status string', () => {
    expect(parseControllerDeploymentOutcome({ status: { status: 'error' } }).ok).toBe(false);
  });
});
