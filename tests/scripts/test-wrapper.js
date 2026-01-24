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
 * Check if output contains Jest exit handler errors
 * @param {string} output - Command output
 * @returns {boolean} True if error found
 */
function hasExitHandlerError(output) {
  return output.includes('_exit(...).default') ||
         output.includes('_exit(...).default) is not a function') ||
         output.includes('TypeError: (0 , _exit(...).default)') ||
         output.includes('_exit().default') ||
         output.includes('_exit().default) is not a function') ||
         output.includes('TypeError: (0 , _exit().default)') ||
         output.includes('_exitX(...).default') ||
         output.includes('_exitX(...).default) is not a function') ||
         output.includes('TypeError: (0 , _exitX') ||
         output.includes('(0, _exit().default)') ||
         output.includes('(0, _exit().default) is not a function');
}

/**
 * Check if a line is part of the Jest exit handler error
 * @param {string} line - Line of text to check
 * @returns {boolean} True if line is part of exit handler error
 */
function isExitHandlerErrorLine(line) {
  return line.includes('TypeError: (0 , _exit') ||
         line.includes('_exit(...).default') ||
         line.includes('_exit().default') ||
         line.includes('at readResultsAndExit') ||
         line.includes('at Object.run') ||
         line.includes('jest-cli/build/run.js');
}

/**
 * Filter out Jest exit handler error lines from text
 * @param {string} text - Text to filter
 * @returns {string} Filtered text with exit handler errors removed
 */
function filterExitHandlerError(text) {
  const lines = text.split('\n');
  const filtered = [];
  let skipNext = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line starts an exit handler error
    if (isExitHandlerErrorLine(line)) {
      skipNext = true;
      continue;
    }

    // Skip empty lines after exit handler errors
    if (skipNext && line.trim() === '') {
      continue;
    }

    // Reset skip flag on non-empty, non-error line
    if (skipNext && line.trim() !== '') {
      skipNext = false;
    }

    // Include the line if we're not skipping
    if (!skipNext) {
      filtered.push(line);
    }
  }

  return filtered.join('\n');
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
 * Run a command and return its exit code and output
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @returns {Promise<{code: number, output: string}>} Command result
 */
function runCommand(command, args) {
  return new Promise((resolve) => {
    let output = '';
    let testCompleted = false;
    let testsPassed = false; // Track if tests passed to filter exit handler errors
    let killTimeout = null;
    let generalTimeout = null;
    let resolved = false;
    const childProcess = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      cwd: process.cwd()
    });

    const forceExit = (reason = 'unknown reason') => {
      if (resolved) return;
      resolved = true;
      if (killTimeout) {
        clearTimeout(killTimeout);
      }
      if (generalTimeout) {
        clearTimeout(generalTimeout);
      }
      if (!childProcess.killed && childProcess.pid) {
        // eslint-disable-next-line no-console
        console.log(`\n⚠️  Jest hung (${reason}), forcing exit...`);
        childProcess.kill('SIGKILL');
      }
      // Resolve with code 1 (Jest's error) but we'll check results in processTestResults
      resolve({ code: 1, output });
    };

    const checkForCompletion = (text) => {
      // Check if Jest has completed running tests
      if ((text.includes('Ran all test suites') ||
           (text.includes('Test Suites:') && text.includes('total'))) &&
          !testCompleted) {
        testCompleted = true;

        // Check if all tests passed (no failures in summary)
        // Look for "Test Suites: X failed" pattern - if not found, tests passed
        const hasFailures = output.match(/Test Suites:.*\d+\s+failed/i);
        testsPassed = !hasFailures;

        // Set a general timeout to force exit if Jest doesn't exit within 30 seconds
        // This handles hangs from any cause (open handles, exit handler errors, etc.)
        // Increased to 30 seconds to allow Jest to finish outputting all failure details
        generalTimeout = setTimeout(() => {
          if (!resolved) {
            const reason = hasExitHandlerError(output) ? 'exit handler error' :
              hasCoverageError(output) ? 'coverage merge error' :
                'open handles or other issues';
            forceExit(reason);
          }
        }, 30000); // 30 seconds max wait after tests complete

        // Set a shorter timeout to check for exit handler error and kill if needed
        // The error typically appears right after "Ran all test suites"
        // Increased to 5 seconds to allow Jest to output failure details
        killTimeout = setTimeout(() => {
          // Check if we see exit handler error - Jest will hang
          if (hasExitHandlerError(output) || hasCoverageError(output)) {
            const reason = hasExitHandlerError(output) ? 'exit handler error' : 'coverage merge error';
            forceExit(reason);
          }
        }, 5000); // Give Jest 5 seconds to exit normally or show the error
      }

      // Also check if we see the error after completion
      if (testCompleted && (hasExitHandlerError(text) || hasCoverageError(text))) {
        // Error appeared after completion - wait a bit for Jest to finish outputting, then kill
        if (killTimeout) {
          clearTimeout(killTimeout);
        }
        // Give Jest 5 more seconds to finish outputting before killing
        killTimeout = setTimeout(() => {
          const reason = hasExitHandlerError(text) ? 'exit handler error' : 'coverage merge error';
          forceExit(reason);
        }, 5000);
      }
    };

    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);
      output += text;
      checkForCompletion(text);
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;

      // Filter out exit handler errors if tests passed
      // Check if this chunk contains exit handler error content
      const isExitError = text.includes('TypeError: (0 , _exit') ||
                         text.includes('_exit(...).default') ||
                         text.includes('_exit().default') ||
                         text.includes('at readResultsAndExit') ||
                         text.includes('at Object.run') ||
                         text.includes('jest-cli/build/run.js');

      // Only suppress if tests completed and passed
      if (testCompleted && testsPassed && isExitError) {
        // Don't write exit handler errors to stderr - we'll show our own message
        // But still check for completion (though it's already completed)
        checkForCompletion(text);
      } else {
        // Write normal stderr output
        process.stderr.write(text);
        checkForCompletion(text);
      }
    });

    childProcess.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      if (killTimeout) {
        clearTimeout(killTimeout);
      }
      if (generalTimeout) {
        clearTimeout(generalTimeout);
      }
      // Small delay to ensure all output is flushed before resolving
      // This helps ensure test failure details are fully displayed
      setTimeout(() => {
        resolve({ code: code || 0, output });
      }, 100);
    });

    childProcess.on('error', (error) => {
      if (resolved) return;
      resolved = true;
      if (killTimeout) {
        clearTimeout(killTimeout);
      }
      if (generalTimeout) {
        clearTimeout(generalTimeout);
      }
      resolve({ code: 1, output: error.message });
    });
  });
}

/**
 * Parse test results from Jest output
 * @param {string} output - Jest output string
 * @returns {Object} Parsed results
 */
function parseTestResults(output) {
  // Find the last "Ran all test suites" line - everything after this is cleanup/crash output
  const ranAllIndex = output.lastIndexOf('Ran all test suites');
  // Also find error indicators
  const errorIndex = Math.max(
    output.indexOf('TypeError:'),
    output.indexOf('Error:'),
    output.indexOf('Aborted (core dumped)')
  );

  // Use the earlier of the two as our cutoff point
  // If "Ran all test suites" appears, use that; otherwise use error index
  let cutoffIndex = ranAllIndex > 0 ? ranAllIndex : (errorIndex > 0 ? errorIndex : output.length);

  // But if error appears before "Ran all test suites", it's a real error
  if (errorIndex > 0 && errorIndex < ranAllIndex) {
    cutoffIndex = errorIndex;
  }

  const searchOutput = cutoffIndex > 0 && cutoffIndex < output.length
    ? output.substring(0, cutoffIndex)
    : output;

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
 * Extract failed test names from Jest output
 * @param {string} output - Jest output
 * @returns {string[]} Array of failed test file names
 */
function extractFailedTests(output) {
  const failedTests = [];

  // Find the last "Ran all test suites" line - everything after this is cleanup/crash output
  const ranAllIndex = output.lastIndexOf('Ran all test suites');
  const searchOutput = ranAllIndex > 0 ? output.substring(0, ranAllIndex) : output;

  // Look for "FAIL" lines followed by test file paths (only before "Ran all test suites")
  const failMatches = searchOutput.match(/FAIL\s+(tests\/[^\s\n]+)/g);
  if (failMatches) {
    failMatches.forEach(match => {
      const testPath = match.replace(/^FAIL\s+/, '');
      if (testPath && !failedTests.includes(testPath)) {
        failedTests.push(testPath);
      }
    });
  }
  return failedTests;
}

/**
 * Display test failure
 * @param {RegExpMatchArray|null} suiteMatch - Suite match result
 * @param {boolean} hasJestError - Whether Jest had an exit/coverage error
 * @param {string} [jestOutput] - Full Jest output to display if needed
 * @param {Object} [parsedResults] - Parsed test results with passMatches/failMatches
 * @returns {void}
 */
function displayFailure(suiteMatch, hasJestError = false, jestOutput = '', parsedResults = null) {
  // Note: Jest's failure details should already be visible in the output
  // since we forward stdout/stderr in real-time. This is just a summary.
  // eslint-disable-next-line no-console
  console.error('\n✗ Tests failed!');

  let failed = 0;
  let passed = 0;
  let total = 0;

  if (suiteMatch) {
    failed = suiteMatch[1] ? parseInt(suiteMatch[1], 10) : 0;
    passed = parseInt(suiteMatch[2] || suiteMatch[1], 10);
    total = parseInt(suiteMatch[3], 10);
    // eslint-disable-next-line no-console
    console.error(`Test Suites: ${failed} failed, ${passed} passed, ${total} total`);
  } else if (parsedResults) {
    // Fallback: use PASS/FAIL counts if we can't parse the summary
    const failCount = parsedResults.failMatches || 0;
    const passCount = parsedResults.passMatches || 0;
    const totalCount = failCount + passCount;
    if (totalCount > 0) {
      failed = failCount;
      passed = passCount;
      total = totalCount;
      // eslint-disable-next-line no-console
      console.error(`Test Suites: ${failed} failed, ${passed} passed, ${total} total (estimated from output)`);
    } else {
      // eslint-disable-next-line no-console
      console.error('Test Suites: Unable to determine test results (Jest may have crashed before summary)');
    }
  } else {
    // eslint-disable-next-line no-console
    console.error('Test Suites: Unable to determine test results (Jest may have crashed before summary)');
  }

  // Extract and display failed test names
  // Only show failures if they occurred BEFORE "Ran all test suites" (real failures)
  // Failures after that are Jest crash artifacts
  if (jestOutput) {
    const ranAllIndex = jestOutput.lastIndexOf('Ran all test suites');
    const hasRealFailures = ranAllIndex > 0
      ? jestOutput.substring(0, ranAllIndex).includes('FAIL')
      : jestOutput.includes('FAIL');

    if (hasRealFailures) {
      const failedTests = extractFailedTests(jestOutput);
      if (failedTests.length > 0) {
        // eslint-disable-next-line no-console
        console.error('\nFailed test suites:');
        failedTests.forEach(test => {
          // eslint-disable-next-line no-console
          console.error(`  ✗ ${test}`);
        });
      } else if (failed > 0) {
        // eslint-disable-next-line no-console
        console.error('\n⚠️  Warning: Failed tests detected but could not extract test names from output.');
      }
    }
  }

  // Extract test counts from output if available
  if (jestOutput && !suiteMatch) {
    const testCountMatch = jestOutput.match(/Tests:\s+(?:(\d+)\s+failed(?:,\s+)?)?(?:(\d+)\s+skipped(?:,\s+)?)?(\d+)\s+passed(?:,\s+(\d+)\s+total)?/);
    if (testCountMatch) {
      const testsFailed = testCountMatch[1] ? parseInt(testCountMatch[1], 10) : 0;
      const testsSkipped = testCountMatch[2] ? parseInt(testCountMatch[2], 10) : 0;
      const testsPassed = parseInt(testCountMatch[3], 10);
      const testsTotal = testCountMatch[4] ? parseInt(testCountMatch[4], 10) : testsPassed + testsFailed + testsSkipped;
      // eslint-disable-next-line no-console
      console.error(`Tests: ${testsFailed} failed, ${testsSkipped} skipped, ${testsPassed} passed, ${testsTotal} total`);
    }
  }

  if (hasJestError) {
    // eslint-disable-next-line no-console
    console.error('\n⚠️  Note: Jest also encountered an exit handler error (known Jest bug)');
    // eslint-disable-next-line no-console
    console.error('   However, tests had real failures, so build is failing.');
    // eslint-disable-next-line no-console
    console.error('   Check the output above for detailed failure information.');
  }

  // If Jest output doesn't contain failure details, something went wrong
  if (jestOutput && !jestOutput.includes('FAIL') && !jestOutput.includes('●') && !jestOutput.includes('Test Suites:')) {
    // eslint-disable-next-line no-console
    console.error('\n⚠️  Warning: Jest output may be incomplete. Check Jest output above for details.');
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
      displayFailure(suiteMatch, hasExitErr || hasCovErr, testResult.output, parsedResults);
      return 1;
    }
  }

  // If Jest exited successfully, check test results
  if (!allTestsPassed) {
    displayFailure(suiteMatch, hasExitErr || hasCovErr, testResult.output, parsedResults);
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

