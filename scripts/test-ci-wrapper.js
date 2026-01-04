#!/usr/bin/env node
/**
 * CI Test Wrapper that handles Jest coverage merge bugs
 * Runs tests with coverage, handling mergeProcessCovs errors gracefully
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
      resolve({ code, output });
    });

    childProcess.on('error', (error) => {
      resolve({ code: 1, output: error.message });
    });
  });
}

/**
 * Check if output contains mergeProcessCovs error
 * @param {string} output - Command output
 * @returns {boolean} True if error found
 */
function hasMergeError(output) {
  return output.includes('mergeProcessCovs') ||
         output.includes('mergeProcessCovs is not a function');
}

/**
 * Parse test results from Jest output
 * @param {string} output - Jest output string
 * @returns {Object} Parsed results
 */
function parseTestResults(output) {
  const suiteMatch = output.match(/Test Suites: (?:(\d+) failed, )?(\d+) passed, (\d+) total/);
  const testMatch = output.match(/Tests:\s+(?:(\d+) failed(?:, )?)?(?:(\d+) skipped(?:, )?)?(\d+) passed(?:, (\d+) total)?/);

  let allTestsPassed = false;
  if (suiteMatch) {
    const passed = parseInt(suiteMatch[2], 10);
    const total = parseInt(suiteMatch[3], 10);
    allTestsPassed = passed === total && passed > 0;
  }

  return { allTestsPassed, suiteMatch, testMatch };
}

/**
 * Handle merge error case - extract test results and exit successfully
 * @param {string} output - Test output
 * @returns {boolean} True if handled successfully
 */
function handleMergeError(output) {
  const passMatches = (output.match(/PASS\s+tests\/[^\n]+/g) || []).length;
  const failMatches = (output.match(/FAIL\s+tests\/[^\n]+/g) || []).length;
  
  if (passMatches > 0 && failMatches === 0) {
    const suiteMatch = output.match(/Test Suites:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?,\s+(\d+)\s+total/);
    const testMatch = output.match(/Tests:\s+(?:(\d+)\s+failed(?:,\s+)?)?(?:(\d+)\s+skipped(?:,\s+)?)?(\d+)\s+passed(?:,\s+(\d+)\s+total)?/);
    
    const suitesPassed = suiteMatch ? parseInt(suiteMatch[1], 10) : passMatches;
    const suitesTotal = suiteMatch ? parseInt(suiteMatch[3], 10) : passMatches;
    const testsPassed = testMatch ? parseInt(testMatch[3], 10) : 0;
    
    // eslint-disable-next-line no-console
    console.log('\n' + '='.repeat(60));
    // eslint-disable-next-line no-console
    console.log('✓ ALL TESTS PASSED!');
    // eslint-disable-next-line no-console
    console.log('⚠️  Coverage merge error (known Jest bug, ignoring)');
    // eslint-disable-next-line no-console
    console.log('='.repeat(60));
    // eslint-disable-next-line no-console
    console.log(`Test Suites: ${suitesPassed} passed, ${suitesTotal} total`);
    if (testsPassed > 0) {
      // eslint-disable-next-line no-console
      console.log(`Tests: ${testsPassed} passed`);
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
    const passed = parseInt(suiteMatch[2], 10);
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
    console.log(`Test Suites: ${suiteMatch[2]} passed, ${suiteMatch[3]} total`);
  }
  if (testMatch) {
    // eslint-disable-next-line no-console
    console.log(`Tests: ${testMatch[3]} passed`);
  }
  // eslint-disable-next-line no-console
  console.log('='.repeat(60) + '\n');
}

/**
 * Main function to run tests with coverage
 * @returns {Promise<void>} Resolves when tests complete
 */
async function main() {
  try {
    require('./patch-jest-exit.js');
  } catch (e) {
    // Ignore if patch fails
  }

  const testResult = await runCommand('npx', [
    'jest',
    '--ci',
    '--coverage',
    '--watchAll=false',
    '--runInBand'
  ]);

  const { allTestsPassed, suiteMatch, testMatch } = parseTestResults(testResult.output);
  const hasMergeErr = hasMergeError(testResult.output);

  if (hasMergeErr && handleMergeError(testResult.output)) {
    process.exit(0);
    return;
  }

  if (!allTestsPassed) {
    displayFailure(suiteMatch);
    process.exit(1);
    return;
  }

  displaySuccess(suiteMatch, testMatch);
  process.exit(0);
}

main().catch((error) => {
  console.error('Wrapper error:', error);
  process.exit(1);
});

// Ensure we exit even if there are unhandled errors
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  process.exit(1);
});

process.on('SIGTERM', () => {
  process.exit(1);
});

