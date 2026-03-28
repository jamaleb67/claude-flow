/**
 * @claude-flow/verification
 * Truth verification, deception detection, and agent scoring for Claude Flow V3
 *
 * This package provides:
 * - Truth scoring for agent claims validation
 * - Deception detection (overconfidence, fabrication, gaslighting)
 * - Agent scoring and reliability tracking
 * - Checkpoint management and rollback capabilities
 * - Byzantine fault tolerance for multi-agent systems
 *
 * Note: Day 1 migration - minimal exports, full exports in Day 2
 */

// Domain Layer - Core deception detector (fork-unique)
export { DeceptionDetector } from './domain/index.js';

// Application Layer - Verification pipeline and stubs
export {
  VerificationPipeline,
  AgentClaimValidator,
  IntegrationTestRunner,
  StateSnapshotManager,
} from './application/index.js';

// API types
export * from './api/index.js';
