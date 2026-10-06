import { angularSeparation, type SkyDirection } from '../geo'
import type { SkyAircraft } from './skyService'

export interface CandidateOptions {
  /** Aircraft farther than this many degrees from the pointing direction are ignored. */
  coneDegrees: number
  /** Maximum number of candidates returned. */
  maxCandidates: number
  /**
   * Separations are compared after rounding to this resolution (degrees); aircraft that land in
   * the same step are ordered nearest-first. Phone compasses are too noisy for smaller
   * differences to mean anything.
   */
  separationResolutionDegrees: number
}

// Starting values, to be tuned with real devices. Phone compasses are typically off by ~10-20 deg.
export const DEFAULT_CANDIDATE_OPTIONS: CandidateOptions = {
  coneDegrees: 20,
  maxCandidates: 3,
  separationResolutionDegrees: 1,
}

export interface Candidate {
  aircraft: SkyAircraft
  /** Angle between the pointing direction and the aircraft, in degrees. */
  separation: number
}

export interface CandidateResult {
  /** Best match first, at most `maxCandidates` entries. */
  candidates: Candidate[]
  /** True when exactly one aircraft is inside the cone, so it can be selected automatically. */
  isClearMatch: boolean
}

/**
 * Pure: ranks aircraft by how close they are to where the user is pointing.
 * Does not modify its input.
 */
export function rankCandidates(
  pointing: SkyDirection,
  sky: SkyAircraft[],
  options: Partial<CandidateOptions> = {},
): CandidateResult {
  const { coneDegrees, maxCandidates, separationResolutionDegrees } = {
    ...DEFAULT_CANDIDATE_OPTIONS,
    ...options,
  }

  const inCone: Candidate[] = sky
    .map((aircraft) => ({ aircraft, separation: angularSeparation(pointing, aircraft) }))
    .filter((c) => c.separation <= coneDegrees)

  const step = (c: Candidate) => Math.round(c.separation / separationResolutionDegrees)
  inCone.sort((a, b) => step(a) - step(b) || a.aircraft.range - b.aircraft.range)

  return {
    candidates: inCone.slice(0, maxCandidates),
    isClearMatch: inCone.length === 1,
  }
}
