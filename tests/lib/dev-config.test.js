/**
 * Tests for Dev Config Module
 *
 * @fileoverview Tests for dev-config.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDevPorts, getBasePorts } = require('../../lib/utils/dev-config');

describe('Dev Config Module', () => {
  describe('getDevPorts', () => {
    it('should calculate ports correctly for developer ID 1', () => {
      const ports = getDevPorts(1);

      expect(ports).toEqual({
        app: 3100,
        postgres: 5532,
        redis: 6479,
        pgadmin: 5150,
        redisCommander: 8181
      });
    });

    it('should calculate ports correctly for developer ID 2', () => {
      const ports = getDevPorts(2);

      expect(ports).toEqual({
        app: 3200,
        postgres: 5632,
        redis: 6579,
        pgadmin: 5250,
        redisCommander: 8281
      });
    });

    it('should calculate ports correctly for developer ID 5', () => {
      const ports = getDevPorts(5);

      expect(ports).toEqual({
        app: 3500,
        postgres: 5932,
        redis: 6879,
        pgadmin: 5550,
        redisCommander: 8581
      });
    });

    it('should calculate ports correctly for developer ID 10', () => {
      const ports = getDevPorts(10);

      expect(ports).toEqual({
        app: 4000,
        postgres: 6432,
        redis: 7379,
        pgadmin: 6050,
        redisCommander: 9081
      });
    });

    it('should throw error when developer ID is not a number', () => {
      expect(() => getDevPorts('1')).toThrow('Developer ID must be a positive number');
      expect(() => getDevPorts('invalid')).toThrow('Developer ID must be a positive number');
      expect(() => getDevPorts(null)).toThrow('Developer ID must be a positive number');
      expect(() => getDevPorts(undefined)).toThrow('Developer ID must be a positive number');
      expect(() => getDevPorts({})).toThrow('Developer ID must be a positive number');
      expect(() => getDevPorts([])).toThrow('Developer ID must be a positive number');
    });

    it('should throw error when developer ID is less than 0', () => {
      expect(() => getDevPorts(-1)).toThrow('Developer ID must be a positive number');
      expect(() => getDevPorts(-10)).toThrow('Developer ID must be a positive number');
    });

    it('should throw error when developer ID is a float', () => {
      expect(() => getDevPorts(0.5)).toThrow('Developer ID must be a positive number');
      expect(() => getDevPorts(0.9)).toThrow('Developer ID must be a positive number');
      expect(() => getDevPorts(1.5)).toThrow('Developer ID must be a positive number');
      expect(() => getDevPorts(10.9)).toThrow('Developer ID must be a positive number');
    });

    it('should handle large developer IDs', () => {
      const ports = getDevPorts(100);

      expect(ports).toEqual({
        app: 13000,
        postgres: 15432,
        redis: 16379,
        pgadmin: 15050,
        redisCommander: 18081
      });
    });
  });

  describe('getBasePorts', () => {
    it('should return base ports object', () => {
      const basePorts = getBasePorts();

      expect(basePorts).toEqual({
        app: 3000,
        postgres: 5432,
        redis: 6379,
        pgadmin: 5050,
        redisCommander: 8081
      });
    });

    it('should return a new object (not reference to BASE_PORTS)', () => {
      const basePorts1 = getBasePorts();
      const basePorts2 = getBasePorts();

      expect(basePorts1).not.toBe(basePorts2);
      expect(basePorts1).toEqual(basePorts2);
    });

    it('should return base ports that match developer ID 0 calculation', () => {
      const basePorts = getBasePorts();

      // If developer ID 0 were allowed, ports would equal base ports
      // Since 0 is not allowed, we verify the base ports directly
      expect(basePorts.app).toBe(3000);
      expect(basePorts.postgres).toBe(5432);
      expect(basePorts.redis).toBe(6379);
      expect(basePorts.pgadmin).toBe(5050);
      expect(basePorts.redisCommander).toBe(8081);
    });
  });
});

