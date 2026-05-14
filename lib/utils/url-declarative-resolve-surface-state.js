/**
 * Declarative url:// **surface state machine** (plan 124 + per-app `applications.<app>.proxy`).
 *
 * FSM inputs (per token target): `perTokenTraefik`, `frontDoorRoutingEnabled` (strict true in yaml).
 * Output phase is the product space (see `PHASE_BY_TRAEFIK_AND_FRONT_DOOR`); `pathActive` matches
 * {@link computePathActive}(perTokenTraefik, frontDoorRoutingEnabled).
 *
 * @fileoverview Single source for `perTokenTraefik` × `frontDoorRouting.enabled` → phase + `pathActive`
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { isDeclarativeTraefikUrlsEnabled } = require('./applications-config-defaults');
const { computePathActive } = require('./url-declarative-url-flags');

/**
 * Public URL surface phase for one url:// token target app.
 * @readonly
 * @enum {string}
 */
const DeclarativeUrlSurfacePhase = {
  /** No Traefik-style hints for this token (`perTokenTraefik` false). */
  DIRECT: 'DIRECT',
  /** Traefik on for Plan 117 path prefix, but `frontDoorRouting.enabled` is not true — no ingress path. */
  TRAEFIK_SCOPED: 'TRAEFIK_SCOPED',
  /** Traefik + front door enabled — `pathActive` / pattern + vdir-public behave as ingress. */
  FRONT_DOOR: 'FRONT_DOOR'
};

/**
 * @typedef {Object} DeclarativeUrlSurfaceInputs
 * @property {Object|null|undefined} userCfg - `~/.aifabrix/config.yaml` root when resolve passes it
 * @property {string} appKey - Target app for the url:// token
 * @property {boolean|undefined} ctxTraefik - Legacy global flag when `userCfg` is absent
 * @property {boolean} frontDoorRoutingEnabled - From `application.yaml` `frontDoorRouting.enabled === true`
 */

/**
 * Bit-pair → phase lookup (explicit FSM output table).
 * Keys: `${perTokenTraefik}:${frontDoorRoutingEnabled}` (booleans coerced to strings).
 *
 * @type {Object.<string, keyof typeof DeclarativeUrlSurfacePhase>}
 */
const PHASE_BY_TRAEFIK_AND_FRONT_DOOR = {
  'false:false': DeclarativeUrlSurfacePhase.DIRECT,
  'false:true': DeclarativeUrlSurfacePhase.DIRECT,
  'true:false': DeclarativeUrlSurfacePhase.TRAEFIK_SCOPED,
  'true:true': DeclarativeUrlSurfacePhase.FRONT_DOOR
};

/**
 * @param {boolean} perTokenTraefik
 * @param {boolean} frontDoorRoutingEnabled
 * @returns {string} {@link DeclarativeUrlSurfacePhase}
 */
function phaseFromTraefikAndFrontDoor(perTokenTraefik, frontDoorRoutingEnabled) {
  const k = `${Boolean(perTokenTraefik)}:${Boolean(frontDoorRoutingEnabled)}`;
  const phase = PHASE_BY_TRAEFIK_AND_FRONT_DOOR[k];
  return phase || DeclarativeUrlSurfacePhase.DIRECT;
}

/**
 * Whether Traefik-style URL hints apply for this token (infra + per-app proxy, or legacy `ctx.traefik`).
 *
 * @param {DeclarativeUrlSurfaceInputs} input
 * @returns {boolean}
 */
function resolvePerTokenTraefik(input) {
  const { userCfg, appKey, ctxTraefik } = input;
  if (userCfg && appKey) {
    return isDeclarativeTraefikUrlsEnabled(userCfg, appKey);
  }
  return Boolean(ctxTraefik);
}

/**
 * Resolve surface phase and derived flags for one declarative url:// target.
 *
 * @param {DeclarativeUrlSurfaceInputs} input
 * @returns {{
 *   phase: string,
 *   perTokenTraefik: boolean,
 *   frontDoorIngressActive: boolean
 * }}
 */
function resolveDeclarativeUrlSurfaceState(input) {
  const frontDoorRoutingEnabled = Boolean(input.frontDoorRoutingEnabled);
  const perTokenTraefik = resolvePerTokenTraefik(input);
  const phase = phaseFromTraefikAndFrontDoor(perTokenTraefik, frontDoorRoutingEnabled);
  const frontDoorIngressActive = computePathActive(perTokenTraefik, frontDoorRoutingEnabled);
  return { phase, perTokenTraefik, frontDoorIngressActive };
}

module.exports = {
  DeclarativeUrlSurfacePhase,
  PHASE_BY_TRAEFIK_AND_FRONT_DOOR,
  phaseFromTraefikAndFrontDoor,
  resolvePerTokenTraefik,
  resolveDeclarativeUrlSurfaceState
};
