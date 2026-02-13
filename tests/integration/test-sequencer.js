/**
 * Custom Jest Test Sequencer
 * Ensures integration tests run in correct order (step-01 through step-09)
 *
 * @fileoverview Custom test sequencer for integration tests
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const Sequencer = require('@jest/test-sequencer').default;

class IntegrationTestSequencer extends Sequencer {
  /**
   * Sort test files to ensure correct execution order
   * @param {Array} tests - Array of test files
   * @returns {Array} Sorted test files
   */
  sort(tests) {
    // Copy tests array to avoid mutating original
    const copy = Array.from(tests);

    // Sort by filename to ensure step-01 through step-09 run in order
    return copy.sort((testA, testB) => {
      const pathA = testA.path;
      const pathB = testB.path;

      // Extract step number from filename (e.g., step-01-create.test.js -> 01)
      const stepA = this.extractStepNumber(pathA);
      const stepB = this.extractStepNumber(pathB);

      // If both have step numbers, sort numerically
      if (stepA !== null && stepB !== null) {
        return stepA - stepB;
      }

      // If only one has step number, prioritize it (0 runs before step-01, etc.)
      if (stepA !== null) return -1;
      if (stepB !== null) return 1;

      // If neither has step number, sort alphabetically
      return pathA.localeCompare(pathB);
    });
  }

  /**
   * Extract step number from test file path
   * @param {string} path - Test file path
   * @returns {number|null} Step number or null if not found
   */
  extractStepNumber(testPath) {
    const match = testPath.match(/step-(\d+)-/);
    if (match) {
      return parseInt(match[1], 10);
    }
    // workflow.test.js should run last (assign high number)
    if (testPath.includes('workflow.test.js')) {
      return 999;
    }
    // Run real-fs–dependent tests first so they run before any test that mocks fs
    if (testPath.includes('compose-generator.test.js') ||
        testPath.includes('paths-detect-app-type.test.js') ||
        testPath.includes('resolve-application-config-path.test.js')) {
      return 0;
    }
    return null;
  }
}

module.exports = IntegrationTestSequencer;

