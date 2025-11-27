/**
 * Tests for Environment Endpoints Utilities
 *
 * @fileoverview Unit tests for env-endpoints.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { updateEndpointVariables } = require('../../../lib/utils/env-endpoints');

describe('updateEndpointVariables', () => {
  it('should update DB_HOST and DB_PORT', () => {
    const envContent = 'DB_HOST=localhost\nDB_PORT=5432\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('DB_HOST=postgres');
    expect(result).toContain('DB_PORT=5432');
  });

  it('should update Keycloak database variables KC_DB_URL_HOST', () => {
    const envContent = 'KC_DB_URL_HOST=localhost\nKC_DB_URL_PORT=5432\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('KC_DB_URL_HOST=postgres');
    expect(result).toContain('KC_DB_URL_PORT=5432');
  });

  it('should update KC_DB_URL_HOST from ${DB_HOST} interpolation result', () => {
    // Simulate what happens when KC_DB_URL_HOST=${DB_HOST} is interpolated to localhost
    // but should be updated to postgres for docker context
    const envContent = 'KC_DB_URL_HOST=localhost\nKC_DB_URL_PORT=5432\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('KC_DB_URL_HOST=postgres');
    expect(result).not.toContain('KC_DB_URL_HOST=localhost');
  });

  it('should update both standard and Keycloak database variables', () => {
    const envContent = [
      'DB_HOST=localhost',
      'DB_PORT=5432',
      'KC_DB_URL_HOST=localhost',
      'KC_DB_URL_PORT=5432',
      'DATABASE_PORT=5432'
    ].join('\n');

    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('DB_HOST=postgres');
    expect(result).toContain('DB_PORT=5432');
    expect(result).toContain('KC_DB_URL_HOST=postgres');
    expect(result).toContain('KC_DB_URL_PORT=5432');
    expect(result).toContain('DATABASE_PORT=5432');
  });

  it('should update KC_DB_URL_HOST for local context (localhost)', () => {
    const envContent = 'KC_DB_URL_HOST=postgres\nKC_DB_URL_PORT=5432\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'localhost', 5432);

    expect(result).toContain('KC_DB_URL_HOST=localhost');
    expect(result).toContain('KC_DB_URL_PORT=5432');
  });

  it('should handle Keycloak variables with different port values', () => {
    const envContent = 'KC_DB_URL_HOST=localhost\nKC_DB_URL_PORT=5432\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5433);

    expect(result).toContain('KC_DB_URL_HOST=postgres');
    expect(result).toContain('KC_DB_URL_PORT=5433');
  });

  it('should not modify other variables when updating Keycloak database variables', () => {
    const envContent = [
      'KC_DB_URL_HOST=localhost',
      'KC_DB_URL_PORT=5432',
      'OTHER_VAR=should-not-change',
      'ANOTHER_KEY=value'
    ].join('\n');

    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('KC_DB_URL_HOST=postgres');
    expect(result).toContain('KC_DB_URL_PORT=5432');
    expect(result).toContain('OTHER_VAR=should-not-change');
    expect(result).toContain('ANOTHER_KEY=value');
  });

  it('should handle Keycloak variables with whitespace', () => {
    const envContent = 'KC_DB_URL_HOST = localhost\nKC_DB_URL_PORT = 5432\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('KC_DB_URL_HOST=postgres');
    expect(result).toContain('KC_DB_URL_PORT=5432');
  });

  it('should update REDIS variables correctly', () => {
    const envContent = 'REDIS_HOST=localhost\nREDIS_PORT=6379\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('REDIS_HOST=redis');
    expect(result).toContain('REDIS_PORT=6379');
  });

  it('should handle complete Keycloak env.template scenario', () => {
    // Simulate the actual Keycloak env.template content
    const envContent = [
      'KC_DB=postgres',
      'KC_DB_URL_HOST=${DB_HOST}',
      'KC_DB_URL_PORT=5432',
      'KC_DB_URL_DATABASE=keycloak',
      'DB_HOST=localhost'
    ].join('\n');

    // After interpolation, KC_DB_URL_HOST would be 'localhost', but for docker it should be 'postgres'
    const interpolated = envContent.replace('${DB_HOST}', 'localhost');
    const result = updateEndpointVariables(interpolated, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('KC_DB_URL_HOST=postgres');
    expect(result).toContain('DB_HOST=postgres');
    expect(result).toContain('KC_DB_URL_PORT=5432');
    expect(result).toContain('KC_DB_URL_DATABASE=keycloak');
  });

  it('should update KC_DB_URL_HOST even when it was incorrectly interpolated to localhost for docker', () => {
    // This simulates the bug: KC_DB_URL_HOST=${DB_HOST} gets interpolated to localhost
    // (maybe because envVars didn't have DB_HOST or wrong context was used)
    // Then rewriteInfraEndpoints should fix it to postgres for docker context
    const envContent = 'KC_DB_URL_HOST=localhost\nDB_HOST=localhost\nKC_DB_URL_PORT=5432';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    // Both should be updated to postgres for docker context
    expect(result).toContain('KC_DB_URL_HOST=postgres');
    expect(result).toContain('DB_HOST=postgres');
    expect(result).not.toContain('KC_DB_URL_HOST=localhost');
    expect(result).not.toContain('DB_HOST=localhost');
  });

  it('should update REDIS_URL to use ${VAR} references', () => {
    const envContent = 'REDIS_URL=redis://localhost:6379\nREDIS_HOST=redis\nREDIS_PORT=6379\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('REDIS_URL=redis://${REDIS_HOST}:${REDIS_PORT}');
    expect(result).toContain('REDIS_HOST=redis');
    expect(result).toContain('REDIS_PORT=6379');
  });

  it('should update DATABASE_URL to use ${VAR} references', () => {
    const envContent = 'DATABASE_URL=postgresql://user:pass@localhost:5432/mydb\nDB_HOST=postgres\nDB_PORT=5432\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('DATABASE_URL=postgresql://user:pass@${DB_HOST}:${DB_PORT}/mydb');
    expect(result).toContain('DB_HOST=postgres');
    expect(result).toContain('DB_PORT=5432');
  });

  it('should update DATABASELOG_URL to use ${VAR} references', () => {
    const envContent = 'DATABASELOG_URL=postgresql://user:pass@localhost:5432/logs\nDB_HOST=postgres\nDB_PORT=5432\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('DATABASELOG_URL=postgresql://user:pass@${DB_HOST}:${DB_PORT}/logs');
    expect(result).toContain('DB_HOST=postgres');
    expect(result).toContain('DB_PORT=5432');
  });

  it('should update multiple database URL variables to use ${VAR} references', () => {
    const envContent = [
      'DATABASE_URL=postgresql://user:pass@localhost:5432/mydb',
      'DATABASELOG_URL=postgresql://user:pass@localhost:5432/logs',
      'DB_HOST=postgres',
      'DB_PORT=5432'
    ].join('\n');
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('DATABASE_URL=postgresql://user:pass@${DB_HOST}:${DB_PORT}/mydb');
    expect(result).toContain('DATABASELOG_URL=postgresql://user:pass@${DB_HOST}:${DB_PORT}/logs');
    expect(result).toContain('DB_HOST=postgres');
    expect(result).toContain('DB_PORT=5432');
  });

  it('should update REDIS_HOST with port pattern to use ${VAR} references', () => {
    const envContent = 'REDIS_HOST=localhost:6379\nREDIS_PORT=6379\n';
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    expect(result).toContain('REDIS_HOST=${REDIS_HOST}:${REDIS_PORT}');
    expect(result).toContain('REDIS_PORT=6379');
  });

  it('should set individual HOST/PORT variables to actual values (not ${VAR})', () => {
    const envContent = [
      'DB_HOST=localhost',
      'DB_PORT=5432',
      'REDIS_HOST=localhost',
      'REDIS_PORT=6379'
    ].join('\n');
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    // Individual variables should use actual values
    expect(result).toContain('DB_HOST=postgres');
    expect(result).toContain('DB_PORT=5432');
    expect(result).toContain('REDIS_HOST=redis');
    expect(result).toContain('REDIS_PORT=6379');
    // Should not contain ${VAR} references for individual variables
    expect(result).not.toContain('DB_HOST=${DB_HOST}');
    expect(result).not.toContain('DB_PORT=${DB_PORT}');
    expect(result).not.toContain('REDIS_HOST=${REDIS_HOST}');
    expect(result).not.toContain('REDIS_PORT=${REDIS_PORT}');
  });

  it('should use ${VAR} references for URLs in docker context', () => {
    const envContent = [
      'REDIS_URL=redis://localhost:6379',
      'DATABASE_URL=postgresql://user:pass@localhost:5432/mydb',
      'REDIS_HOST=redis',
      'REDIS_PORT=6379',
      'DB_HOST=postgres',
      'DB_PORT=5432'
    ].join('\n');
    const result = updateEndpointVariables(envContent, 'redis', 6379, 'postgres', 5432);

    // URLs should use ${VAR} references
    expect(result).toContain('REDIS_URL=redis://${REDIS_HOST}:${REDIS_PORT}');
    expect(result).toContain('DATABASE_URL=postgresql://user:pass@${DB_HOST}:${DB_PORT}/mydb');
    // Individual variables should use actual docker service names
    expect(result).toContain('REDIS_HOST=redis');
    expect(result).toContain('REDIS_PORT=6379');
    expect(result).toContain('DB_HOST=postgres');
    expect(result).toContain('DB_PORT=5432');
  });

  it('should use ${VAR} references for URLs in local context', () => {
    const envContent = [
      'REDIS_URL=redis://localhost:6379',
      'DATABASE_URL=postgresql://user:pass@localhost:5432/mydb',
      'REDIS_HOST=localhost',
      'REDIS_PORT=6379',
      'DB_HOST=localhost',
      'DB_PORT=5432'
    ].join('\n');
    const result = updateEndpointVariables(envContent, 'localhost', 6379, 'localhost', 5432);

    // URLs should use ${VAR} references
    expect(result).toContain('REDIS_URL=redis://${REDIS_HOST}:${REDIS_PORT}');
    expect(result).toContain('DATABASE_URL=postgresql://user:pass@${DB_HOST}:${DB_PORT}/mydb');
    // Individual variables should use actual localhost values
    expect(result).toContain('REDIS_HOST=localhost');
    expect(result).toContain('REDIS_PORT=6379');
    expect(result).toContain('DB_HOST=localhost');
    expect(result).toContain('DB_PORT=5432');
  });
});

