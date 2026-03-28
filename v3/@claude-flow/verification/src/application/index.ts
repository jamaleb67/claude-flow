/**
 * Application Layer - Verification workflows and orchestration
 * Contains pipelines, hooks, middleware, and managers
 *
 * Day 2 migration - expanded exports
 */

// Fork-unique pipeline
export { VerificationPipeline } from './pipeline.js';

// Checkpoint and rollback management
export { CheckpointManager } from './checkpoint-manager.js';
export { RollbackEngine } from './rollback-engine.js';

// Stub implementations
export { AgentClaimValidator } from './agent-claim-validator.js';
export { IntegrationTestRunner } from './integration-test-runner.js';
export { StateSnapshotManager } from './state-snapshot.js';

// Hooks system
export * from './hooks.js';

// Middleware
export * from './middleware.js';
