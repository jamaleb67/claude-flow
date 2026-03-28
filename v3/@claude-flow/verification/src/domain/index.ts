/**
 * Domain Layer - Core verification domain logic
 * Contains types, interfaces, scorers, and detectors
 *
 * Note: Day 1 migration - selective exports to avoid conflicts
 */

// Core types (avoiding re-export conflicts)
export type {
  VerificationLevel,
  VerificationStatus,
  CheckpointType,
  ClaimType,
  TruthScoreConfig,
  TruthScoringWeights,
  TruthValidationChecks,
  ConfidenceConfig,
} from './types.js';

// Core class - DeceptionDetector (fork-unique)
export { DeceptionDetector } from './deception-detector.js';
