/**
 * @fileoverview Tests for controller-health.api (extract helpers)
 */

const {
  extractDeploymentTypeFromHealthResponse
} = require('../../../lib/api/controller-health.api');

describe('controller-health.api', () => {
  it('extractDeploymentTypeFromHealthResponse reads nested data.data.deploymentType', () => {
    const dt = extractDeploymentTypeFromHealthResponse({
      success: true,
      data: {
        data: {
          status: 'healthy',
          deploymentType: 'database'
        }
      }
    });
    expect(dt).toBe('database');
  });

  it('returns undefined when success is false', () => {
    expect(extractDeploymentTypeFromHealthResponse({ success: false, data: {} })).toBeUndefined();
  });
});
