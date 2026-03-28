/**
 * Application Layer - Verification workflows and orchestration
 * Contains pipelines, hooks, middleware, and managers
 *
 * Note: Day 1 migration - selective exports to avoid conflicts
 */

// Fork-unique pipeline
export { VerificationPipeline } from './pipeline.js';

// Stub implementations (ready for Day 2)
export { AgentClaimValidator } from './agent-claim-validator.js';
export { IntegrationTestRunner } from './integration-test-runner.js';
export { StateSnapshotManager } from './state-snapshot.js';
