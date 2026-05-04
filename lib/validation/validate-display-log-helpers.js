/**
 * @fileoverview Shared log helpers for validate-display (layout.md tty-summary).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { sectionTitle, metadata, successGlyph } = require('../utils/cli-test-layout-chalk');

function logSectionTitle(title) {
  logger.log(`\n${sectionTitle(title)}`);
}

function logOkRowRest(message) {
  logger.log(`  ${successGlyph()} ${chalk.white(message)}`);
}

function logWarnRow(message) {
  logger.log(`  ${chalk.yellow('⚠')} ${chalk.white(message)}`);
}

function logDimLine(text) {
  logger.log(metadata(`    ${text}`));
}

function logErrorDetail(message) {
  logger.log(`    ${chalk.red(`• ${message}`)}`);
}

module.exports = {
  logSectionTitle,
  logOkRowRest,
  logWarnRow,
  logDimLine,
  logErrorDetail
};
