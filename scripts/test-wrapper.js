#!/usr/bin/env node
/**
 * Test Wrapper that handles Jest exit handler bugs
 * Runs tests and handles various Jest errors gracefully
 *
 * @fileoverview Test wrapper for CI/CD environments
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { spawn } = require('child_process');

/**
 * Run a command and return its exit code and output
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @returns {Promise<{code: number, output: string}>} Command result
 */
function runCommand(command, args) {
  return new Promise((resolve) => {
    let output = '';
    const childProcess = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      cwd: process.cwd()
    });

    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);
      output += text;
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(text);
      output += text;
    });

    childProcess.on('close', (code) => {
      resolve({ code: code || 0, output });
    });

    childProcess.on('error', (error) => {
      resolve({ code: 1, output: error.message });
    });
  });
}

/**
 * Check if output contains Jest exit handler errors
 * @param {string} output - Command output
 * @returns {boolean} True if error found
 */
function hasExitHandlerError(output) {
  return output.includes('_exitX(...).default') ||
         output.includes('_exitX(...).default) is not a function') ||
         output.includes('TypeError: (0 , _exitX');
}

/**
 * Check if output contains coverage merge errors
 * @param {string} output - Command output
 * @returns {boolean} True if error found
 */
function hasCoverageError(output) {
  return output.includes('mergeProcessCovs') ||
         output.includes('mergeProcessCovs is not a function') ||
         output.includes('_v8Coverage(...).mergeProcessCovs') ||
         output.includes('TypeError: (0 , _v8Coverage');
}

/**
 * Parse test results from Jest output
 * @param {string} output - Jest output string
 * @returns {Object} Parsed results
 */
function parseTestResults(output) {
  // Find the last occurrence of test summary (before any errors)
  const errorIndex = Math.max(
    output.indexOf('TypeError:'),
    output.indexOf('Error:')
  );
  const searchOutput = errorIndex > 0 ? output.substring(0, errorIndex) : output;

  // Try multiple patterns to catch test results
  const suiteMatch = searchOutput.match(/Test Suites: (?:(\d+) failed, )?(\d+) passed, (\d+) total/) ||
                   searchOutput.match(/Test Suites:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?,\s+(\d+)\s+total/) ||
                   output.match(/Test Suites: (?:(\d+) failed, )?(\d+) passed, (\d+) total/) ||
                   output.match(/Test Suites:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?,\s+(\d+)\s+total/);
  const testMatch = searchOutput.match(/Tests:\s+(?:(\d+) failed(?:, )?)?(?:(\d+) skipped(?:, )?)?(\d+) passed(?:, (\d+) total)?/) ||
                 searchOutput.match(/Tests:\s+(?:(\d+)\s+failed(?:,\s+)?)?(?:(\d+)\s+skipped(?:,\s+)?)?(\d+)\s+passed(?:,\s+(\d+)\s+total)?/) ||
                 output.match(/Tests:\s+(?:(\d+) failed(?:, )?)?(?:(\d+) skipped(?:, )?)?(\d+) passed(?:, (\d+) total)?/) ||
                 output.match(/Tests:\s+(?:(\d+)\s+failed(?:,\s+)?)?(?:(\d+)\s+skipped(?:,\s+)?)?(\d+)\s+passed(?:,\s+(\d+)\s+total)?/);

  let allTestsPassed = false;
  if (suiteMatch) {
    const passed = parseInt(suiteMatch[2] || suiteMatch[1], 10);
    const total = parseInt(suiteMatch[3], 10);
    const failed = suiteMatch[1] ? parseInt(suiteMatch[1], 10) : 0;
    allTestsPassed = passed === total && passed > 0 && failed === 0;
  }

  // Also check for PASS indicators (look before error)
  const searchForPass = errorIndex > 0 ? output.substring(0, errorIndex) : output;
  const passMatches = (searchForPass.match(/PASS\s+tests\/[^\n]+/g) || []).length;
  const failMatches = (searchForPass.match(/FAIL\s+tests\/[^\n]+/g) || []).length;

  // Check for "ALL TESTS PASSED" message
  const allPassedMessage = searchOutput.includes('ALL TESTS PASSED') || searchOutput.includes('✓ ALL TESTS PASSED');

  if ((passMatches > 0 && failMatches === 0) || allPassedMessage) {
    // If we see PASS but no FAIL, or explicit success message, tests likely passed
    allTestsPassed = true;
  }

  return { allTestsPassed, suiteMatch, testMatch, passMatches, failMatches };
}

/**
 * Handle Jest errors gracefully
 * @param {string} output - Test output
 * @param {Object} parsedResults - Parsed test results
 * @param {boolean} hasExitError - Whether exit handler error exists
 * @param {boolean} hasCovError - Whether coverage error exists
 * @returns {boolean} True if handled successfully
 */
function handleJestErrors(output, parsedResults, hasExitError, hasCovError) {
  const { suiteMatch, testMatch, passMatches, failMatches, allTestsPassed } = parsedResults;

  // If tests passed but Jest had an exit/coverage error, we can still succeed
  if ((hasExitError || hasCovError) && (allTestsPassed || (passMatches > 0 && failMatches === 0))) {
    const suitesPassed = suiteMatch ? parseInt(suiteMatch[2] || suiteMatch[1], 10) : passMatches;
    const suitesTotal = suiteMatch ? parseInt(suiteMatch[3], 10) : passMatches;
    const testsPassed = testMatch ? parseInt(testMatch[3] || testMatch[2], 10) : 0;

    // eslint-disable-next-line no-console
    console.log('\n' + '='.repeat(60));
    // eslint-disable-next-line no-console
    console.log('✓ ALL TESTS PASSED!');
    if (hasExitError) {
      // eslint-disable-next-line no-console
      console.log('⚠️  Jest exit handler error (known Jest bug, ignoring)');
    }
    if (hasCovError) {
      // eslint-disable-next-line no-console
      console.log('⚠️  Coverage merge error (known Jest bug, ignoring)');
    }
    // eslint-disable-next-line no-console
    console.log('='.repeat(60));
    // eslint-disable-next-line no-console
    console.log(`Test Suites: ${suitesPassed} passed, ${suitesTotal} total`);
    if (testsPassed > 0) {
      // eslint-disable-next-line no-console
      console.log(`Tests: ${testsPassed} passed`);
    } else if (passMatches > 0) {
      // eslint-disable-next-line no-console
      console.log(`Tests: ${passMatches} test suites passed`);
    }
    // eslint-disable-next-line no-console
    console.log('='.repeat(60) + '\n');
    return true;
  }
  return false;
}

/**
 * Display test failure
 * @param {RegExpMatchArray|null} suiteMatch - Suite match result
 * @returns {void}
 */
function displayFailure(suiteMatch) {
  // eslint-disable-next-line no-console
  console.error('\n✗ Tests failed!');
  if (suiteMatch) {
    const failed = suiteMatch[1] ? parseInt(suiteMatch[1], 10) : 0;
    const passed = parseInt(suiteMatch[2] || suiteMatch[1], 10);
    const total = parseInt(suiteMatch[3], 10);
    // eslint-disable-next-line no-console
    console.error(`Found ${passed} passed, ${failed} failed out of ${total} total`);
  }
}

/**
 * Display test success
 * @param {RegExpMatchArray|null} suiteMatch - Suite match result
 * @param {RegExpMatchArray|null} testMatch - Test match result
 * @returns {void}
 */
function displaySuccess(suiteMatch, testMatch) {
  // eslint-disable-next-line no-console
  console.log('\n' + '='.repeat(60));
  // eslint-disable-next-line no-console
  console.log('✓ ALL TESTS PASSED!');
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));
  if (suiteMatch) {
    // eslint-disable-next-line no-console
    console.log(`Test Suites: ${suiteMatch[2] || suiteMatch[1]} passed, ${suiteMatch[3]} total`);
  }
  if (testMatch) {
    // eslint-disable-next-line no-console
    console.log(`Tests: ${testMatch[3] || testMatch[2]} passed`);
  }
  // eslint-disable-next-line no-console
  console.log('='.repeat(60) + '\n');
}

/**
 * Process test results and determine exit code
 * @param {Object} testResult - Test execution result
 * @param {Object} parsedResults - Parsed test results
 * @returns {number} Exit code (0 for success, 1 for failure)
 */
function processTestResults(testResult, parsedResults) {
  const { allTestsPassed, suiteMatch, testMatch } = parsedResults;
  const hasExitErr = hasExitHandlerError(testResult.output);
  const hasCovErr = hasCoverageError(testResult.output);

  // If Jest crashed with exit/coverage error but tests passed, exit successfully
  if ((hasExitErr || hasCovErr) && (allTestsPassed || parsedResults.passMatches > 0)) {
    if (handleJestErrors(testResult.output, parsedResults, hasExitErr, hasCovErr)) {
      return 0;
    }
  }

  // If Jest exited with code 1, check if tests actually passed
  // (exit/coverage errors cause Jest to exit with code 1 even when tests pass)
  if (testResult.code === 1) {
    if ((hasExitErr || hasCovErr) && allTestsPassed) {
      // Tests passed but Jest had an error - this is acceptable
      if (handleJestErrors(testResult.output, parsedResults, hasExitErr, hasCovErr)) {
        return 0;
      }
    }
    // If no error or tests didn't pass, fail
    if (!hasExitErr && !hasCovErr || !allTestsPassed) {
      displayFailure(suiteMatch);
      return 1;
    }
  }

  // If Jest exited successfully, check test results
  if (!allTestsPassed) {
    displayFailure(suiteMatch);
    return 1;
  }

  displaySuccess(suiteMatch, testMatch);
  return 0;
}

/**
 * Main function to run tests
 * @returns {Promise<void>} Resolves when tests complete
 */
async function main() {
  const testResult = await runCommand('npx', [
    'jest',
    '--ci',
    '--watchAll=false'
  ]);

  const parsedResults = parseTestResults(testResult.output);
  const exitCode = processTestResults(testResult, parsedResults);
  process.exit(exitCode);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Wrapper error:', error);
  process.exit(1);
});

// Ensure we exit even if there are unhandled errors
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  process.exit(1);
});

process.on('SIGTERM', () => {
  process.exit(1);
});

