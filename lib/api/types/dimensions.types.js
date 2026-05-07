/**
 * @fileoverview Dimensions API type definitions (Controller)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Dimension create/update payload (Controller catalog)
 * @typedef {Object} DimensionCreateRequest
 * @property {string} key
 * @property {string} displayName
 * @property {string} [description]
 * @property {'string'|'number'|'boolean'} dataType
 * @property {boolean} [isRequired]
 */

/**
 * Dimension entity
 * @typedef {Object} Dimension
 * @property {string} id
 * @property {string} key
 * @property {string} displayName
 * @property {string|null} [description]
 * @property {'string'|'number'|'boolean'} dataType
 * @property {boolean} isRequired
 * @property {string|null} [createdBy]
 * @property {string|null} [updatedBy]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

