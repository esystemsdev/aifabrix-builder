/**
 * Tests for Command Header Display
 *
 * @fileoverview Tests for command-header.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { displayCommandHeader } = require('../../../lib/utils/command-header');
const logger = require('../../../lib/utils/logger');

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));

describe('Command Header Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display controller, environment, and dataplane', () => {
    displayCommandHeader(
      'https://controller.example.com',
      'dev',
      'https://dataplane.example.com'
    );

    expect(logger.log).toHaveBeenCalled();
    const call = logger.log.mock.calls[0][0];
    expect(call).toContain('Controller:');
    expect(call).toContain('Environment:');
    expect(call).toContain('Dataplane:');
    expect(call).toContain('https://controller.example.com');
    expect(call).toContain('dev');
    expect(call).toContain('https://dataplane.example.com');
  });

  it('should display only controller and environment if dataplane not provided', () => {
    displayCommandHeader(
      'https://controller.example.com',
      'dev'
    );

    expect(logger.log).toHaveBeenCalled();
    const call = logger.log.mock.calls[0][0];
    expect(call).toContain('Controller:');
    expect(call).toContain('Environment:');
    expect(call).not.toContain('Dataplane:');
  });

  it('should not display anything if all parameters are empty', () => {
    displayCommandHeader('', '', '');

    expect(logger.log).not.toHaveBeenCalled();
  });

  it('should handle null values gracefully', () => {
    displayCommandHeader(null, null, null);

    expect(logger.log).not.toHaveBeenCalled();
  });
});
