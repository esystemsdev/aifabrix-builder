/**
 * CLI utility command setup (resolve, json, split-json, genkey, show, validate, diff).
 *
 * @fileoverview Utility command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const secrets = require('../core/secrets');
const generator = require('../generator');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { detectAppType, getDeployJsonPath } = require('../utils/paths');

/**
 * Handles split-json command logic
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Paths to generated files
 */
async function handleSplitJsonCommand(appName, options) {
  const { appPath, appType } = await detectAppType(appName, options);

  const outputDir = options.output || appPath;
  if (appType === 'external') {
    const schemaPath = path.join(appPath, 'application-schema.json');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`application-schema.json not found: ${schemaPath}`);
    }
    return generator.splitExternalApplicationSchema(schemaPath, outputDir);
  }

  const deployJsonPath = getDeployJsonPath(appName, appType, true);
  if (!fs.existsSync(deployJsonPath)) {
    throw new Error(`Deployment JSON file not found: ${deployJsonPath}`);
  }

  return generator.splitDeployJson(deployJsonPath, outputDir);
}

/**
 * Logs split-json results
 * @param {Object} result - Generated file paths
 * @returns {void}
 */
function logSplitJsonResult(result) {
  logger.log(chalk.green('\n✓ Successfully split deployment JSON into component files:'));
  logger.log(`  • env.template: ${result.envTemplate}`);
  logger.log(`  • variables.yaml: ${result.variables}`);
  if (result.rbac) {
    logger.log(`  • rbac.yml: ${result.rbac}`);
  }
  logger.log(`  • README.md: ${result.readme}`);
}

/**
 * Sets up utility commands
 * @param {Command} program - Commander program instance
 */
function setupUtilityCommands(program) {
  program.command('resolve <app>')
    .description('Generate .env file from template and validate application files')
    .option('-f, --force', 'Generate missing secret keys in secrets file')
    .option('--skip-validation', 'Skip file validation after generating .env')
    .action(async(appName, options) => {
      try {
        const envPath = await secrets.generateEnvFile(appName, undefined, 'docker', options.force);
        logger.log(`✓ Generated .env file: ${envPath}`);

        if (!options.skipValidation) {
          const validate = require('../validation/validate');
          const result = await validate.validateAppOrFile(appName);
          validate.displayValidationResults(result);
          if (!result.valid) {
            logger.log(chalk.yellow('\n⚠️  Validation found errors. Fix them before deploying.'));
            process.exit(1);
          }
        }
      } catch (error) {
        handleCommandError(error, 'resolve');
        process.exit(1);
      }
    });

  program.command('json <app>')
    .description('Generate deployment JSON (aifabrix-deploy.json for normal apps, application-schema.json for external systems)')
    .option('--type <type>', 'Application type (external) - if set, only checks integration folder')
    .action(async(appName, options) => {
      try {
        const result = await generator.generateDeployJsonWithValidation(appName, options);
        if (result.success) {
          const fileName = result.path.includes('application-schema.json') ? 'application-schema.json' : 'deployment JSON';
          logger.log(`✓ Generated ${fileName}: ${result.path}`);

          if (result.validation.warnings && result.validation.warnings.length > 0) {
            logger.log('\n⚠️  Warnings:');
            result.validation.warnings.forEach(warning => logger.log(`   • ${warning}`));
          }
        } else {
          logger.log('❌ Validation failed:');
          if (result.validation.errors && result.validation.errors.length > 0) {
            result.validation.errors.forEach(error => logger.log(`   • ${error}`));
          }
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'json');
        process.exit(1);
      }
    });

  program.command('split-json <app>')
    .description('Split deployment JSON into component files (env.template, variables.yaml, rbac.yml, README.md)')
    .option('-o, --output <dir>', 'Output directory for component files (defaults to same directory as JSON)')
    .option('--type <type>', 'Application type (external) - if set, only checks integration folder')
    .action(async(appName, options) => {
      try {
        const result = await handleSplitJsonCommand(appName, options);
        logSplitJsonResult(result);
      } catch (error) {
        handleCommandError(error, 'split-json');
        process.exit(1);
      }
    });

  program.command('genkey <app>')
    .description('Generate deployment key')
    .action(async(appName) => {
      try {
        const jsonPath = await generator.generateDeployJson(appName);

        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const deployment = JSON.parse(jsonContent);

        const key = deployment.deploymentKey;

        if (!key) {
          throw new Error('deploymentKey not found in generated JSON');
        }

        logger.log(`\nDeployment key for ${appName}:`);
        logger.log(key);
        logger.log(chalk.gray(`\nGenerated from: ${jsonPath}`));
      } catch (error) {
        handleCommandError(error, 'genkey');
        process.exit(1);
      }
    });

  program.command('show <appKey>')
    .description('Show application info from local builder/ or integration/ (offline) or from controller (--online)')
    .option('--online', 'Fetch application data from the controller')
    .option('--json', 'Output as JSON')
    .action(async(appKey, options) => {
      try {
        const { showApp } = require('../app/show');
        await showApp(appKey, { online: options.online, json: options.json });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });

  program.command('validate <appOrFile>')
    .description('Validate application or external integration file')
    .option('--type <type>', 'Application type (external) - if set, only checks integration folder')
    .action(async(appOrFile, options) => {
      try {
        const validate = require('../validation/validate');
        const result = await validate.validateAppOrFile(appOrFile, options);
        validate.displayValidationResults(result);
        if (!result.valid) {
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'validate');
        process.exit(1);
      }
    });

  program.command('diff <file1> <file2>')
    .description('Compare two configuration files (for deployment pipeline)')
    .action(async(file1, file2) => {
      try {
        const diff = require('../core/diff');
        const result = await diff.compareFiles(file1, file2);
        diff.formatDiffOutput(result);
        if (!result.identical) {
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'diff');
        process.exit(1);
      }
    });
}

module.exports = { setupUtilityCommands };
