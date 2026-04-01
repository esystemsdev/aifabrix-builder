/**
 * Validation Display Utilities
 *
 * Display functions for validation results output.
 *
 * @fileoverview Validation display utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { loadConfigFile } = require('../utils/config-format');

/**
 * Displays application validation results
 * @function displayApplicationValidation
 * @param {Object} application - Application validation result
 */
function displayApplicationValidation(application) {
  if (!application) {
    return;
  }

  logger.log(chalk.blue('\nApplication:'));
  if (application.valid) {
    logger.log(chalk.green('  ✓ Application configuration is valid'));
  } else {
    logger.log(chalk.red('  ✗ Application configuration has errors:'));
    if (application.errors && application.errors.length > 0) {
      application.errors.forEach(error => {
        logger.log(chalk.red(`    • ${error}`));
      });
    }
  }
  if (application.warnings && application.warnings.length > 0) {
    application.warnings.forEach(warning => {
      logger.log(chalk.yellow(`    ⚠ ${warning}`));
    });
  }
}

/**
 * Extracts dimensions from a datasource file
 * @function extractDimensionsFromDatasource
 * @param {string} filePath - Path to datasource file
 * @returns {Object} Dimensions info { dimensions: Object, dimensionKeys: string[], hasDimensions: boolean }
 */
function extractDimensionsFromDatasource(filePath) {
  try {
    const parsed = loadConfigFile(filePath);

    const rootFlat = {};
    const root = parsed.dimensions;
    if (root && typeof root === 'object' && !Array.isArray(root)) {
      for (const [dimKey, binding] of Object.entries(root)) {
        if (binding && typeof binding === 'object' && typeof binding.field === 'string') {
          rootFlat[dimKey] = `metadata.${binding.field}`;
        }
      }
    }
    const abacDimensions = parsed.abac?.dimensions || {};
    const allDimensions = { ...rootFlat, ...abacDimensions };
    const dimensionKeys = Object.keys(allDimensions);

    return {
      dimensions: allDimensions,
      dimensionKeys,
      hasDimensions: dimensionKeys.length > 0
    };
  } catch {
    return { dimensions: {}, dimensionKeys: [], hasDimensions: false };
  }
}

/**
 * Displays external files validation results
 * @function displayExternalFilesValidation
 * @param {Array} externalFiles - External files validation results
 */
function displayExternalFilesValidation(externalFiles) {
  if (!externalFiles || externalFiles.length === 0) {
    return;
  }

  logger.log(chalk.blue('\nExternal Integration Files:'));
  externalFiles.forEach(file => {
    if (file.valid) {
      logger.log(chalk.green(`  ✓ ${file.file} (${file.type})`));
    } else {
      logger.log(chalk.red(`  ✗ ${file.file} (${file.type}):`));
      file.errors.forEach(error => {
        logger.log(chalk.red(`    • ${error}`));
      });
    }
    if (file.warnings && file.warnings.length > 0) {
      file.warnings.forEach(warning => {
        logger.log(chalk.yellow(`    ⚠ ${warning}`));
      });
    }
  });
}

/**
 * Displays Dimensions (ABAC) validation results for datasources
 * @function displayDimensionsValidation
 * @param {Array} externalFiles - External files validation results
 * @returns {Array} Warnings to add to aggregated warnings
 */
function displayDimensionsValidation(externalFiles) {
  if (!externalFiles || externalFiles.length === 0) {
    return [];
  }

  const datasourceFiles = externalFiles.filter(f =>
    f.type === 'datasource' || f.type === 'external-datasource'
  );

  if (datasourceFiles.length === 0) {
    return [];
  }

  logger.log(chalk.blue('\nDimensions (ABAC):'));

  const warnings = [];
  let anyDatasourceHasDimensions = false;

  datasourceFiles.forEach(file => {
    const dimensionsInfo = extractDimensionsFromDatasource(file.path);

    if (dimensionsInfo.hasDimensions) {
      anyDatasourceHasDimensions = true;
      logger.log(chalk.green(`  ✓ ${file.file}`));
      dimensionsInfo.dimensionKeys.forEach(key => {
        const mapping = dimensionsInfo.dimensions[key];
        logger.log(chalk.gray(`      ${key} → ${mapping}`));
      });
    } else {
      logger.log(chalk.yellow(`  ⚠ ${file.file} - no dimensions configured`));
      warnings.push(`${file.file} - no dimensions configured, ABAC filtering disabled`);
    }
  });

  if (!anyDatasourceHasDimensions) {
    logger.log(chalk.yellow('    ⚠ No dimensions configured - ABAC filtering disabled for all datasources'));
  }

  return warnings;
}

/**
 * Displays RBAC validation results
 * @function displayRbacValidation
 * @param {Object} rbac - RBAC validation result
 */
function displayRbacValidation(rbac) {
  if (!rbac) {
    return;
  }

  logger.log(chalk.blue('\nRBAC Configuration:'));
  if (rbac.valid) {
    logger.log(chalk.green('  ✓ RBAC configuration is valid'));
  } else {
    logger.log(chalk.red('  ✗ RBAC configuration has errors:'));
    rbac.errors.forEach(error => {
      logger.log(chalk.red(`    • ${error}`));
    });
  }
  if (rbac.warnings && rbac.warnings.length > 0) {
    rbac.warnings.forEach(warning => {
      logger.log(chalk.yellow(`    ⚠ ${warning}`));
    });
  }
}

/**
 * Displays file validation results (for direct file validation)
 * @function displayFileValidation
 * @param {Object} result - Validation result
 */
function displayFileValidation(result) {
  if (!result.file) {
    return;
  }

  logger.log(chalk.blue(`\nFile: ${result.file}`));
  logger.log(chalk.blue(`Type: ${result.type}`));
  if (result.valid) {
    logger.log(chalk.green('  ✓ File is valid'));
  } else {
    logger.log(chalk.red('  ✗ File has errors:'));
    result.errors.forEach(error => {
      logger.log(chalk.red(`    • ${error}`));
    });
  }
  if (result.warnings && result.warnings.length > 0) {
    result.warnings.forEach(warning => {
      logger.log(chalk.yellow(`    ⚠ ${warning}`));
    });
  }
}

/**
 * Displays aggregated warnings
 * @function displayAggregatedWarnings
 * @param {Array} warnings - Array of warning messages
 */
function displayAggregatedWarnings(warnings) {
  if (!warnings || warnings.length === 0) {
    return;
  }

  logger.log(chalk.yellow('\nWarnings:'));
  warnings.forEach(warning => {
    logger.log(chalk.yellow(`  • ${warning}`));
  });
}

/**
 * Displays application validation step
 * @function displayApplicationStep
 * @param {Object} application - Application validation result
 * @returns {void}
 */
function displayApplicationStep(application) {
  logger.log(chalk.blue('\nApplication:'));
  if (application.valid) {
    logger.log(chalk.green('  ✓ Application configuration is valid'));
  } else {
    logger.log(chalk.red('  ✗ Application configuration has errors:'));
    application.errors.forEach(error => {
      logger.log(chalk.red(`    • ${error}`));
    });
  }
  if (application.warnings && application.warnings.length > 0) {
    application.warnings.forEach(warning => {
      logger.log(chalk.yellow(`    ⚠ ${warning}`));
    });
  }
}

/**
 * Displays external integration files step
 * @function displayComponentsStep
 * @param {Object} components - Components validation result
 * @returns {void}
 */
function displayComponentsStep(components) {
  const hasFiles = components.files && components.files.length > 0;
  const hasErrors = components.errors && components.errors.length > 0;
  if (!hasFiles && !hasErrors) {
    return;
  }

  logger.log(chalk.blue('\nExternal Integration Files:'));
  if (hasFiles) {
    components.files.forEach(file => {
      if (file.valid) {
        logger.log(chalk.green(`  ✓ ${file.file} (${file.type})`));
      } else {
        logger.log(chalk.red(`  ✗ ${file.file} (${file.type})`));
      }
    });
  }
  if (hasErrors) {
    components.errors.forEach(error => {
      logger.log(chalk.red(`  • ${error}`));
    });
  }
}

/**
 * Displays dimensions validation for datasources
 * @function displayDimensionsStep
 * @param {Array} datasourceFiles - Datasource files
 * @returns {void}
 */
function displayDimensionsStep(datasourceFiles) {
  if (datasourceFiles.length === 0) {
    return;
  }

  logger.log(chalk.blue('\nDimensions (ABAC):'));
  datasourceFiles.forEach(file => {
    try {
      const dimensionsInfo = extractDimensionsFromDatasource(file.path || file.file);
      if (dimensionsInfo.hasDimensions) {
        logger.log(chalk.green(`  ✓ ${file.file}`));
        dimensionsInfo.dimensionKeys.forEach(key => {
          const mapping = dimensionsInfo.dimensions[key];
          logger.log(chalk.gray(`      ${key} → ${mapping}`));
        });
      } else {
        logger.log(chalk.yellow(`  ⚠ ${file.file} - no dimensions configured`));
      }
    } catch {
      // Skip if file path not available
    }
  });
}

/**
 * Displays deployment manifest step
 * @function displayManifestStep
 * @param {Object} manifest - Manifest validation result
 * @param {Array} componentFiles - Component files
 * @returns {void}
 */
function displayManifestStep(manifest, componentFiles) {
  logger.log(chalk.blue('\nDeployment Manifest:'));
  if (manifest.skipped) {
    logger.log(chalk.yellow('  ⊘ Skipped (fix errors above first)'));
  } else if (manifest.valid) {
    logger.log(chalk.green('  ✓ Full deployment manifest is valid'));
    if (componentFiles) {
      const datasourceFiles = componentFiles.filter(f => f.type === 'datasource' || f.type === 'external-datasource');
      logger.log(chalk.green('    ✓ System configuration valid'));
      logger.log(chalk.green(`    ✓ ${datasourceFiles.length} datasource(s) valid`));
      logger.log(chalk.green('    ✓ Schema validation passed'));
    }
  } else {
    logger.log(chalk.red('  ✗ Full deployment manifest validation failed:'));
    const errs = manifest.errors && manifest.errors.length > 0 ? manifest.errors : [];
    if (errs.length > 0) {
      errs.forEach(error => {
        const msg = typeof error === 'string' ? error : String(error);
        logger.log(chalk.red(`    • ${msg}`));
      });
    } else {
      logger.log(chalk.red('    • No error details available (check schema and manifest structure).'));
    }
  }
  if (manifest.warnings && manifest.warnings.length > 0) {
    manifest.warnings.forEach(warning => {
      logger.log(chalk.yellow(`    ⚠ ${warning}`));
    });
  }
}

/**
 * Displays step-by-step validation results for external systems
 * @function displayStepByStepValidation
 * @param {Object} result - Validation result with steps
 */
function displayStepByStepValidation(result) {
  if (result.valid) {
    logger.log(chalk.green('\n✓ Validation passed!'));
  } else {
    logger.log(chalk.red('\n✗ Validation failed!'));
  }

  displayApplicationStep(result.steps.application);

  if (!result.steps.components.valid || (result.steps.components.files && result.steps.components.files.length > 0)) {
    displayComponentsStep(result.steps.components);
  }

  const datasourceFiles = result.steps.components.files?.filter(f =>
    f.type === 'datasource' || f.type === 'external-datasource'
  ) || [];
  displayDimensionsStep(datasourceFiles);

  if (result.rbac) {
    displayRbacValidation(result.rbac);
  }

  displayManifestStep(result.steps.manifest, result.steps.components.files);

  if (result.warnings && result.warnings.length > 0) {
    displayAggregatedWarnings(result.warnings);
  }

  displayOverallStatus(result);
  if (result.appPath) {
    logger.log(chalk.gray(`\n${path.resolve(result.appPath)}`));
  }
}

/**
 * Displays batch validation results (per-app blocks then summary).
 * Expects batchResult.batch === true and batchResult.results.
 * @function displayBatchValidationResults
 * @param {Object} batchResult - Batch result from validateAllIntegrations / validateAllBuilderApps / validateAll
 */
function displayBatchValidationResults(batchResult) {
  if (!batchResult || batchResult.batch !== true || !Array.isArray(batchResult.results)) {
    return;
  }

  const results = batchResult.results;
  results.forEach(item => {
    logger.log(chalk.blue(`\n--- ${item.appName} ---`));
    if (item.error) {
      logger.log(chalk.red(`  ✗ ${item.error}`));
    } else if (item.result) {
      displayValidationResults(item.result);
    }
  });

  const passed = results.filter(r => r.result && r.result.valid).length;
  const failed = results.length - passed;
  logger.log(chalk.blue('\n--- Summary ---'));
  if (failed === 0) {
    logger.log(chalk.green(`✓ ${passed} passed, 0 failed`));
    logger.log(chalk.green('Overall: Passed'));
  } else {
    logger.log(chalk.red(`✗ ${passed} passed, ${failed} failed`));
    logger.log(chalk.red('Overall: Failed'));
  }
}

/**
 * Displays overall validation status
 * @param {Object} result - Validation result
 */
function displayOverallStatus(result) {
  let hasErrors = result.errors && result.errors.length > 0;
  if (!hasErrors && result.steps) {
    const stepErrors = [result.steps.application, result.steps.components, result.steps.manifest]
      .filter(Boolean)
      .some(s => s.errors && s.errors.length > 0);
    if (stepErrors) {
      hasErrors = true;
    }
  }
  const hasWarnings = result.warnings && result.warnings.length > 0;
  if (hasErrors) {
    logger.log(chalk.red('\nOverall: Failed'));
  } else if (hasWarnings) {
    logger.log(chalk.yellow('\nOverall: Passed with warnings'));
  } else {
    logger.log(chalk.green('\nOverall: Passed'));
  }
}

/**
 * Displays validation results in a user-friendly format
 *
 * @function displayValidationResults
 * @param {Object} result - Validation result from validateAppOrFile
 */
function displayValidationResults(result) {
  // Check if this is a step-by-step result (from validateExternalSystemComplete)
  if (result.steps) {
    displayStepByStepValidation(result);
    return;
  }

  // Legacy format (for regular apps)
  if (result.valid) {
    logger.log(chalk.green('\n✓ Validation passed!'));
  } else {
    logger.log(chalk.red('\n✗ Validation failed!'));
  }

  displayApplicationValidation(result.application);
  displayExternalFilesValidation(result.externalFiles);

  // Display Dimensions (ABAC) for datasources and collect warnings
  const dimensionWarnings = displayDimensionsValidation(result.externalFiles);

  displayRbacValidation(result.rbac);
  displayFileValidation(result);

  // Combine all warnings
  const allWarnings = [...(result.warnings || []), ...dimensionWarnings];
  displayAggregatedWarnings(allWarnings);

  displayOverallStatus(result);
  if (result.appPath) {
    logger.log(chalk.gray(`\n${path.resolve(result.appPath)}`));
  }
}

module.exports = {
  displayValidationResults,
  displayBatchValidationResults,
  displayStepByStepValidation,
  displayApplicationValidation,
  displayExternalFilesValidation,
  displayDimensionsValidation,
  displayRbacValidation,
  displayFileValidation,
  displayAggregatedWarnings,
  extractDimensionsFromDatasource
};
