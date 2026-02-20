/**
 * Vector database name predicate for Docker Compose generation.
 * Used so db-init can run CREATE EXTENSION vector on vector-store databases.
 * @fileoverview Vector database name helper for compose-generator
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Returns true when the database name ends with "vector" (case-insensitive).
 * @param {string} name - Database name
 * @returns {boolean}
 */
function isVectorDatabaseName(name) {
  return name !== null && name !== undefined && String(name).toLowerCase().endsWith('vector');
}

module.exports = { isVectorDatabaseName };
