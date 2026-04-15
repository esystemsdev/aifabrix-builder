/**
 * Runs after tests/setup.js. That file sets jest.setTimeout(5000) for fast unit tests;
 * integration suites need the timeout from jest.config.integration.js (testTimeout).
 * @fileoverview Restore long Jest timeout for Docker integration tests
 */
jest.setTimeout(300000);
