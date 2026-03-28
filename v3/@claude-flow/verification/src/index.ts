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
 * Day 2 migration status:
 * - Core domain types: Exported
 * - DeceptionDetector: Exported (fork-unique)
 * - Pipeline stubs: Exported
 * - Security module: Exported
 * - Checkpoint/Rollback: Exported
 *
 * Files pending type alignment (Day 3+):
 * - telemetry.ts, alert-manager.ts, system-tracker.ts
 * - verification-pipeline.ts, truth-scorer.ts, agent-scorer.ts
 */

// Domain Layer - Core types and deception detector (fork-unique)
export * from './domain/index.js';

// Application Layer - Pipeline, checkpoint, rollback, stubs (selective to avoid conflicts)
export {
  VerificationPipeline,
  CheckpointManager,
  RollbackEngine,
  AgentClaimValidator,
  IntegrationTestRunner,
  StateSnapshotManager,
  SecurityMiddlewareManager,
  ThreatIntelligenceMiddleware,
  IPFilterMiddleware,
  SecurityLoggingMiddleware,
} from './application/index.js';

// Infrastructure Layer - CLI integration
export * from './infrastructure/index.js';

// API types (selective to avoid conflicts with domain types)
export {
  TruthMonitoringEvent,
  VerificationQuery,
  VerificationMetrics,
} from './api/index.js';
