/**
 * Infrastructure Layer - External integrations and persistence
 * Contains adapters, exporters, trackers, and CLI integration
 *
 * Day 2 migration - CLI integration exported
 * Pending (Day 3+): telemetry, alert-manager, system-tracker, dashboard-exporter
 */

// CLI integration - all exports for v2 bridge compatibility
export {
  VerificationCommand,
  CommandOption,
  VerificationCLICommands,
  initializeVerificationCLI,
  createVerificationCommand,
  integrateWithClaudeFlowCLI,
  executeVerificationFromCLI
} from './cli-integration.js';
