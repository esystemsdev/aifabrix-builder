/**
 * @fileoverview Declarative url:// surface state machine — phase table + invariants
 */

'use strict';

const {
  DeclarativeUrlSurfacePhase,
  PHASE_BY_TRAEFIK_AND_FRONT_DOOR,
  phaseFromTraefikAndFrontDoor,
  resolvePerTokenTraefik,
  resolveDeclarativeUrlSurfaceState
} = require('../../../lib/utils/url-declarative-resolve-surface-state');
const { computePathActive } = require('../../../lib/utils/url-declarative-url-flags');

describe('url-declarative-resolve-surface-state', () => {
  describe('PHASE_BY_TRAEFIK_AND_FRONT_DOOR', () => {
    it('covers all four boolean pairs exactly once', () => {
      const keys = Object.keys(PHASE_BY_TRAEFIK_AND_FRONT_DOOR).sort();
      expect(keys).toEqual(['false:false', 'false:true', 'true:false', 'true:true']);
    });
  });

  describe('phaseFromTraefikAndFrontDoor', () => {
    it.each([
      [false, false, DeclarativeUrlSurfacePhase.DIRECT],
      [false, true, DeclarativeUrlSurfacePhase.DIRECT],
      [true, false, DeclarativeUrlSurfacePhase.TRAEFIK_SCOPED],
      [true, true, DeclarativeUrlSurfacePhase.FRONT_DOOR]
    ])('(%s, %s) → %s', (tf, fd, expected) => {
      expect(phaseFromTraefikAndFrontDoor(tf, fd)).toBe(expected);
    });
  });

  describe('resolvePerTokenTraefik', () => {
    it('uses ctxTraefik when userCfg is absent', () => {
      expect(resolvePerTokenTraefik({ userCfg: null, appKey: 'keycloak', ctxTraefik: true, frontDoorRoutingEnabled: true })).toBe(true);
      expect(resolvePerTokenTraefik({ userCfg: undefined, appKey: 'keycloak', ctxTraefik: false, frontDoorRoutingEnabled: true })).toBe(false);
    });

    it('uses isDeclarativeTraefikUrlsEnabled when userCfg and appKey are set', () => {
      const userCfg = { traefik: true, applications: { keycloak: { proxy: true } } };
      expect(resolvePerTokenTraefik({ userCfg, appKey: 'keycloak', ctxTraefik: false, frontDoorRoutingEnabled: true })).toBe(true);
    });

    it('respects global traefik off with userCfg', () => {
      const userCfg = { traefik: false, applications: { keycloak: { proxy: true } } };
      expect(resolvePerTokenTraefik({ userCfg, appKey: 'keycloak', ctxTraefik: true, frontDoorRoutingEnabled: true })).toBe(false);
    });

    it('respects per-app proxy off with userCfg', () => {
      const userCfg = { traefik: true, applications: { keycloak: { proxy: false } } };
      expect(resolvePerTokenTraefik({ userCfg, appKey: 'keycloak', ctxTraefik: true, frontDoorRoutingEnabled: true })).toBe(false);
    });

    it('falls back to ctxTraefik when userCfg is set but appKey is empty', () => {
      const userCfg = { traefik: true, applications: { keycloak: { proxy: true } } };
      expect(resolvePerTokenTraefik({ userCfg, appKey: '', ctxTraefik: true, frontDoorRoutingEnabled: true })).toBe(true);
      expect(resolvePerTokenTraefik({ userCfg, appKey: '', ctxTraefik: false, frontDoorRoutingEnabled: true })).toBe(false);
    });
  });

  describe('resolveDeclarativeUrlSurfaceState', () => {
    it('keeps frontDoorIngressActive aligned with computePathActive for all phase rows', () => {
      for (const tf of [false, true]) {
        for (const fd of [false, true]) {
          const { perTokenTraefik, frontDoorIngressActive, phase } = resolveDeclarativeUrlSurfaceState({
            userCfg: null,
            appKey: 'x',
            ctxTraefik: tf,
            frontDoorRoutingEnabled: fd
          });
          expect(perTokenTraefik).toBe(tf);
          expect(frontDoorIngressActive).toBe(computePathActive(tf, fd));
          expect(phase).toBe(phaseFromTraefikAndFrontDoor(tf, fd));
          if (phase === DeclarativeUrlSurfacePhase.FRONT_DOOR) {
            expect(frontDoorIngressActive).toBe(true);
          } else {
            expect(frontDoorIngressActive).toBe(false);
          }
        }
      }
    });

    it('userCfg path: ctxTraefik ignored; phase follows proxy × front door', () => {
      const userCfg = { traefik: true, applications: { svc: { proxy: true } } };
      const r = resolveDeclarativeUrlSurfaceState({
        userCfg,
        appKey: 'svc',
        ctxTraefik: false,
        frontDoorRoutingEnabled: true
      });
      expect(r.perTokenTraefik).toBe(true);
      expect(r.phase).toBe(DeclarativeUrlSurfacePhase.FRONT_DOOR);
      expect(r.frontDoorIngressActive).toBe(true);
    });

    it('userCfg path: traefik on but front door disabled → TRAEFIK_SCOPED', () => {
      const userCfg = { traefik: true, applications: { svc: { proxy: true } } };
      const r = resolveDeclarativeUrlSurfaceState({
        userCfg,
        appKey: 'svc',
        ctxTraefik: false,
        frontDoorRoutingEnabled: false
      });
      expect(r.phase).toBe(DeclarativeUrlSurfacePhase.TRAEFIK_SCOPED);
      expect(r.frontDoorIngressActive).toBe(false);
    });
  });
});
