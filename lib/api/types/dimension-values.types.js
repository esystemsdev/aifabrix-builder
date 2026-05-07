/**
 * @fileoverview Dimension values API type definitions (Controller)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Create dimension value payload
 * @typedef {Object} DimensionValueCreateRequest
 * @property {string} value
 * @property {string} [displayName]
 * @property {string} [description]
 */

/**
 * Dimension value entity
 * @typedef {Object} DimensionValue
 * @property {string} id
 * @property {string} dimensionId
 * @property {string} value
 * @property {string|null} [displayName]
 * @property {string|null} [description]
 * @property {string|null} [createdBy]
 * @property {string|null} [updatedBy]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

