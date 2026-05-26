/**
 * Sets CI flags before tests/setup.js loads (for setup-ci-live-fabrix-guard isolated project).
 *
 * @fileoverview Pre-setup env for CI live-path guard regression test
 */

'use strict';

process.env.CI = 'true';
process.env.CI_SIMULATION = 'true';
process.env.JEST_WORKER_ID = '1';
