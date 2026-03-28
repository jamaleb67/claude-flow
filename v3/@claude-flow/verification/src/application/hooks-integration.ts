/**
 * Verification Hooks Integration
 *
 * Integrates @claude-flow/verification with @claude-flow/hooks.
 * Provides pre-task and post-task verification hooks that leverage
 * the ReasoningBank for pattern learning and truth scoring.
 */

import { createLogger } from '../shared/external-types.js';
import type {
  VerificationContext,
  VerificationResult,
  SimpleTruthScore,
  DeceptionPattern,
  AgentClaim,
} from '../domain/types.js';

const logger = createLogger('VerificationHooksIntegration');

// ===== Hook Integration Types =====

export interface VerificationHookConfig {
  enablePreTask: boolean;
  enablePostTask: boolean;
  enableTruthScoring: boolean;
  enableDeceptionDetection: boolean;
  truthThreshold: number;
  deceptionThreshold: number;
  autoRollbackOnDeception: boolean;
}

export interface VerificationHookResult {
  success: boolean;
  phase: 'pre-task' | 'post-task';
  truthScore?: SimpleTruthScore;
  deceptionPatterns?: DeceptionPattern[];
  shouldContinue: boolean;
  recommendations?: string[];
  metrics?: Record<string, number>;
}

export interface HooksIntegrationOptions {
  hooksModule?: any; // @claude-flow/hooks module when available
  config?: Partial<VerificationHookConfig>;
}

// ===== Default Configuration =====

const DEFAULT_CONFIG: VerificationHookConfig = {
  enablePreTask: true,
  enablePostTask: true,
  enableTruthScoring: true,
  enableDeceptionDetection: true,
  truthThreshold: 0.8,
  deceptionThreshold: 0.3,
  autoRollbackOnDeception: false,
};

// ===== Hooks Integration Manager =====

export class VerificationHooksIntegration {
  private config: VerificationHookConfig;
  private hooksModule: any = null;
  private registeredHookIds: string[] = [];
  private isInitialized = false;

  constructor(options?: HooksIntegrationOptions) {
    this.config = { ...DEFAULT_CONFIG, ...options?.config };
    this.hooksModule = options?.hooksModule;
  }

  /**
   * Initialize hooks integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Hooks integration already initialized');
      return;
    }

    // Try to load @claude-flow/hooks if not provided
    if (!this.hooksModule) {
      try {
        this.hooksModule = await import('@claude-flow/hooks' as any);
        logger.info('Successfully loaded @claude-flow/hooks');
      } catch (error) {
        logger.debug('@claude-flow/hooks not available, using standalone mode');
      }
    }

    // Register verification hooks if hooks module is available
    if (this.hooksModule) {
      await this.registerHooks();
    }

    this.isInitialized = true;
    logger.info('Verification hooks integration initialized');
  }

  /**
   * Register verification hooks with the hooks system
   */
  private async registerHooks(): Promise<void> {
    if (!this.hooksModule) return;

    const { registerHook, HookPriority } = this.hooksModule;

    // Register pre-task verification hook
    if (this.config.enablePreTask) {
      const preTaskHookId = registerHook(
        'PreTask',
        this.createPreTaskHandler(),
        HookPriority?.High ?? 100,
        { name: 'verification-pre-task' }
      );
      this.registeredHookIds.push(preTaskHookId);
      logger.debug('Registered pre-task verification hook:', preTaskHookId);
    }

    // Register post-task verification hook
    if (this.config.enablePostTask) {
      const postTaskHookId = registerHook(
        'PostTask',
        this.createPostTaskHandler(),
        HookPriority?.High ?? 100,
        { name: 'verification-post-task' }
      );
      this.registeredHookIds.push(postTaskHookId);
      logger.debug('Registered post-task verification hook:', postTaskHookId);
    }
  }

  /**
   * Create pre-task verification handler
   */
  private createPreTaskHandler() {
    return async (context: any): Promise<VerificationHookResult> => {
      logger.debug('Running pre-task verification hook');

      const result: VerificationHookResult = {
        success: true,
        phase: 'pre-task',
        shouldContinue: true,
        recommendations: [],
        metrics: {},
      };

      try {
        // Check task context for verification requirements
        const taskId = context?.taskId || context?.metadata?.taskId;
        const agentId = context?.agentId || context?.metadata?.agentId;

        if (!taskId) {
          logger.debug('No task ID in context, skipping verification');
          return result;
        }

        // Create verification context
        const verificationContext: VerificationContext = {
          taskId,
          agentId: agentId || 'unknown',
          timestamp: new Date(),
          claims: [],
          evidence: [],
          metadata: context?.metadata || {},
        };

        // Store verification context for post-task
        this.storeVerificationContext(verificationContext);

        // Run pre-task truth baseline if enabled
        if (this.config.enableTruthScoring && this.hooksModule?.reasoningBank) {
          const patterns = await this.hooksModule.reasoningBank.query({
            type: 'verification',
            taskId,
          });
          result.metrics = {
            baselinePatterns: patterns?.length || 0,
          };
        }

        result.recommendations?.push('Pre-task verification complete');
        logger.info(`Pre-task verification passed for task ${taskId}`);
      } catch (error) {
        logger.error('Pre-task verification failed:', error);
        result.success = false;
        result.recommendations?.push(`Verification error: ${error}`);
      }

      return result;
    };
  }

  /**
   * Create post-task verification handler
   */
  private createPostTaskHandler() {
    return async (context: any): Promise<VerificationHookResult> => {
      logger.debug('Running post-task verification hook');

      const result: VerificationHookResult = {
        success: true,
        phase: 'post-task',
        shouldContinue: true,
        recommendations: [],
        metrics: {},
      };

      try {
        const taskId = context?.taskId || context?.metadata?.taskId;

        if (!taskId) {
          logger.debug('No task ID in context, skipping verification');
          return result;
        }

        // Retrieve stored verification context
        const verificationContext = this.retrieveVerificationContext(taskId);

        // Calculate truth score
        if (this.config.enableTruthScoring) {
          const truthScore = await this.calculateSimpleTruthScore(context, verificationContext);
          result.truthScore = truthScore;
          result.metrics!['truthScore'] = truthScore.overall;

          if (truthScore.overall < this.config.truthThreshold) {
            result.recommendations?.push(
              `Truth score ${truthScore.overall.toFixed(2)} below threshold ${this.config.truthThreshold}`
            );
            result.shouldContinue = false;
          }
        }

        // Run deception detection
        if (this.config.enableDeceptionDetection) {
          const deceptionPatterns = await this.detectDeception(context, verificationContext);
          result.deceptionPatterns = deceptionPatterns;
          result.metrics!['deceptionPatterns'] = deceptionPatterns.length;

          if (deceptionPatterns.length > 0) {
            const maxSeverity = Math.max(...deceptionPatterns.map((p) => p.severity));
            result.metrics!['maxDeceptionSeverity'] = maxSeverity;

            if (maxSeverity > this.config.deceptionThreshold) {
              result.recommendations?.push(
                `Deception detected: ${deceptionPatterns.map((p) => p.type).join(', ')}`
              );
              if (this.config.autoRollbackOnDeception) {
                result.shouldContinue = false;
                result.recommendations?.push('Auto-rollback triggered');
              }
            }
          }
        }

        // Store patterns in ReasoningBank if available
        if (this.hooksModule?.reasoningBank && result.truthScore) {
          await this.storeVerificationPattern(taskId, result);
        }

        result.success = result.shouldContinue;
        logger.info(`Post-task verification ${result.success ? 'passed' : 'failed'} for task ${taskId}`);
      } catch (error) {
        logger.error('Post-task verification failed:', error);
        result.success = false;
        result.recommendations?.push(`Verification error: ${error}`);
      }

      return result;
    };
  }

  /**
   * Calculate truth score for task output
   */
  private async calculateSimpleTruthScore(
    context: any,
    verificationContext?: VerificationContext
  ): Promise<SimpleTruthScore> {
    // Default truth score calculation
    const score: SimpleTruthScore = {
      overall: 1.0,
      accuracy: 1.0,
      consistency: 1.0,
      confidence: 1.0,
      timestamp: new Date(),
    };

    // If we have claims to verify, calculate based on evidence
    if (verificationContext?.claims && verificationContext.claims.length > 0) {
      const verifiedClaims = verificationContext.claims.filter(
        (c) => c.status === 'passed'
      );
      score.accuracy = verifiedClaims.length / verificationContext.claims.length;
    }

    // Check consistency with prior patterns
    if (this.hooksModule?.reasoningBank) {
      try {
        const priorPatterns = await this.hooksModule.reasoningBank.query({
          type: 'verification',
          limit: 5,
        });
        if (priorPatterns && priorPatterns.length > 0) {
          // Calculate consistency with prior successful patterns
          score.consistency = 0.9; // Simplified for now
        }
      } catch (error) {
        logger.debug('Could not query prior patterns:', error);
      }
    }

    // Calculate overall score
    score.overall = (score.accuracy + score.consistency + score.confidence) / 3;

    return score;
  }

  /**
   * Detect deception patterns in task output
   */
  private async detectDeception(
    context: any,
    verificationContext?: VerificationContext
  ): Promise<DeceptionPattern[]> {
    const patterns: DeceptionPattern[] = [];

    // Check for overconfidence
    if (context?.confidence && context.confidence > 0.99 && !context?.evidence) {
      patterns.push({
        type: 'overconfidence',
        severity: 0.5,
        description: 'High confidence claim without supporting evidence',
        detectedAt: new Date(),
      });
    }

    // Check for fabrication indicators
    if (context?.claims) {
      const unverifiedClaims = (context.claims as any[]).filter(
        (c) => c.status === 'pending' && c.confidence > 0.8
      );
      if (unverifiedClaims.length > 0) {
        patterns.push({
          type: 'fabrication',
          severity: 0.7,
          description: `${unverifiedClaims.length} high-confidence pending claims`,
          detectedAt: new Date(),
        });
      }
    }

    return patterns;
  }

  /**
   * Store verification context for later retrieval
   */
  private verificationContexts = new Map<string, VerificationContext>();

  private storeVerificationContext(context: VerificationContext): void {
    this.verificationContexts.set(context.taskId, context);
  }

  private retrieveVerificationContext(taskId: string): VerificationContext | undefined {
    return this.verificationContexts.get(taskId);
  }

  /**
   * Store verification pattern in ReasoningBank
   */
  private async storeVerificationPattern(
    taskId: string,
    result: VerificationHookResult
  ): Promise<void> {
    if (!this.hooksModule?.reasoningBank) return;

    try {
      await this.hooksModule.reasoningBank.store({
        type: 'verification',
        taskId,
        timestamp: new Date().toISOString(),
        truthScore: result.truthScore?.overall,
        success: result.success,
        deceptionCount: result.deceptionPatterns?.length || 0,
      });
      logger.debug(`Stored verification pattern for task ${taskId}`);
    } catch (error) {
      logger.debug('Could not store verification pattern:', error);
    }
  }

  /**
   * Unregister all hooks
   */
  async shutdown(): Promise<void> {
    if (!this.hooksModule) return;

    const { unregisterHook } = this.hooksModule;
    for (const hookId of this.registeredHookIds) {
      try {
        unregisterHook(hookId);
        logger.debug('Unregistered hook:', hookId);
      } catch (error) {
        logger.debug('Could not unregister hook:', hookId, error);
      }
    }

    this.registeredHookIds = [];
    this.isInitialized = false;
    logger.info('Verification hooks integration shutdown complete');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VerificationHookConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Updated hooks integration config:', config);
  }

  /**
   * Get current configuration
   */
  getConfig(): VerificationHookConfig {
    return { ...this.config };
  }

  /**
   * Get integration status
   */
  getStatus(): {
    initialized: boolean;
    hooksAvailable: boolean;
    registeredHooks: number;
    config: VerificationHookConfig;
  } {
    return {
      initialized: this.isInitialized,
      hooksAvailable: !!this.hooksModule,
      registeredHooks: this.registeredHookIds.length,
      config: this.config,
    };
  }
}

// ===== Singleton Instance =====

let defaultIntegration: VerificationHooksIntegration | null = null;

export function getDefaultHooksIntegration(): VerificationHooksIntegration {
  if (!defaultIntegration) {
    defaultIntegration = new VerificationHooksIntegration();
  }
  return defaultIntegration;
}

export async function initializeHooksIntegration(
  options?: HooksIntegrationOptions
): Promise<VerificationHooksIntegration> {
  const integration = new VerificationHooksIntegration(options);
  await integration.initialize();
  defaultIntegration = integration;
  return integration;
}

// ===== Standalone Hook Handlers =====

/**
 * Standalone pre-task verification handler for use without full integration
 */
export async function runPreTaskVerification(context: any): Promise<VerificationHookResult> {
  const integration = getDefaultHooksIntegration();
  if (!integration.getStatus().initialized) {
    await integration.initialize();
  }

  // Create a temporary handler and execute
  const handler = (integration as any).createPreTaskHandler();
  return handler(context);
}

/**
 * Standalone post-task verification handler for use without full integration
 */
export async function runPostTaskVerification(context: any): Promise<VerificationHookResult> {
  const integration = getDefaultHooksIntegration();
  if (!integration.getStatus().initialized) {
    await integration.initialize();
  }

  // Create a temporary handler and execute
  const handler = (integration as any).createPostTaskHandler();
  return handler(context);
}
