'use strict';

const {
  RUN_TYPE_TO_STAGE,
  stageForRunType,
  withStageOnValidationRunBody
} = require('../../../lib/utils/validation-run-stage');

describe('validation-run-stage', () => {
  it('maps runType to contract stage', () => {
    expect(RUN_TYPE_TO_STAGE.test).toBe('readiness');
    expect(stageForRunType('integration')).toBe('integration');
    expect(stageForRunType('e2e')).toBe('e2e');
    expect(stageForRunType('unknown')).toBe('readiness');
  });

  it('adds stage when missing on validation body', () => {
    const body = withStageOnValidationRunBody(
      { systemKey: 'hubspot', runType: 'e2e' },
      'e2e'
    );
    expect(body.stage).toBe('e2e');
  });

  it('preserves explicit stage', () => {
    const body = withStageOnValidationRunBody(
      { runType: 'test', stage: 'readiness' },
      'test'
    );
    expect(body.stage).toBe('readiness');
  });
});
