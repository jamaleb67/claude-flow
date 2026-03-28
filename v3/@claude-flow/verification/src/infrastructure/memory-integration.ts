/**
 * Verification Memory Integration
 *
 * Integrates @claude-flow/verification with @claude-flow/memory.
 * Provides persistence for verification results, truth scores,
 * and deception patterns using AgentDB-backed unified memory.
 */

import { createLogger } from '../shared/external-types.js';
import type {
  TruthScore,
  VerificationResult,
  DeceptionPattern,
  AgentClaim,
  VerificationContext,
} from '../domain/types.js';

const logger = createLogger('VerificationMemoryIntegration');

// ===== Memory Entry Types =====

export interface VerificationMemoryEntry {
  id: string;
  type: 'truth_score' | 'verification_result' | 'deception_pattern' | 'claim_history';
  taskId?: string;
  agentId?: string;
  swarmId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface TruthScoreEntry extends VerificationMemoryEntry {
  type: 'truth_score';
  data: {
    score: number;
    components: Record<string, number>;
    confidence: number;
  };
}

export interface DeceptionEntry extends VerificationMemoryEntry {
  type: 'deception_pattern';
  data: {
    patterns: DeceptionPattern[];
    severity: number;
    actionTaken: string;
  };
}

export interface VerificationHistoryEntry extends VerificationMemoryEntry {
  type: 'verification_result';
  data: {
    status: string;
    passed: boolean;
    score: number;
    duration: number;
    checkpointResults: any[];
  };
}

// ===== Configuration =====

export interface MemoryIntegrationConfig {
  namespace: string;
  enableTruthHistory: boolean;
  enableDeceptionTracking: boolean;
  enableAgentReliability: boolean;
  maxHistoryEntries: number;
  retentionDays: number;
}

const DEFAULT_CONFIG: MemoryIntegrationConfig = {
  namespace: 'verification',
  enableTruthHistory: true,
  enableDeceptionTracking: true,
  enableAgentReliability: true,
  maxHistoryEntries: 1000,
  retentionDays: 90,
};

// ===== Memory Integration Class =====

export class VerificationMemoryIntegration {
  private config: MemoryIntegrationConfig;
  private memoryModule: any = null;
  private memoryService: any = null;
  private isInitialized = false;

  constructor(config?: Partial<MemoryIntegrationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize memory integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Memory integration already initialized');
      return;
    }

    // Try to load @claude-flow/memory
    try {
      this.memoryModule = await import('@claude-flow/memory' as any);
      logger.info('Successfully loaded @claude-flow/memory');

      // Initialize memory service with verification namespace
      if (this.memoryModule.UnifiedMemoryService) {
        this.memoryService = new this.memoryModule.UnifiedMemoryService({
          namespace: this.config.namespace,
          cacheEnabled: true,
        });
        await this.memoryService.initialize?.();
      }
    } catch (error) {
      logger.debug('@claude-flow/memory not available, using in-memory fallback');
      this.memoryService = this.createInMemoryFallback();
    }

    this.isInitialized = true;
    logger.info('Verification memory integration initialized');
  }

  /**
   * Create in-memory fallback when @claude-flow/memory not available
   */
  private createInMemoryFallback(): any {
    const storage = new Map<string, VerificationMemoryEntry>();

    return {
      store: async (entry: any) => {
        storage.set(entry.key || entry.id, entry);
        return entry.key || entry.id;
      },
      retrieve: async (key: string) => storage.get(key),
      search: async (query: string) => {
        const results: any[] = [];
        storage.forEach((entry) => {
          const content = JSON.stringify(entry).toLowerCase();
          if (content.includes(query.toLowerCase())) {
            results.push({ entry, score: 0.5 });
          }
        });
        return results;
      },
      delete: async (key: string) => storage.delete(key),
      list: async (prefix?: string) => {
        const results: any[] = [];
        storage.forEach((entry, key) => {
          if (!prefix || key.startsWith(prefix)) {
            results.push(entry);
          }
        });
        return results;
      },
    };
  }

  /**
   * Store truth score in memory
   */
  async storeTruthScore(
    taskId: string,
    agentId: string,
    score: TruthScore
  ): Promise<string> {
    if (!this.config.enableTruthHistory) {
      return '';
    }

    const entry: TruthScoreEntry = {
      id: `truth-${taskId}-${Date.now()}`,
      type: 'truth_score',
      taskId,
      agentId,
      data: {
        score: score.score,
        components: { ...score.components } as Record<string, number>,
        confidence: score.confidence.level,
      },
      timestamp: new Date(),
      tags: ['truth-score', `agent:${agentId}`, `task:${taskId}`],
      metadata: (score.metadata || {}) as Record<string, unknown>,
    };

    try {
      await this.memoryService.store({
        key: entry.id,
        content: JSON.stringify(entry.data),
        tags: entry.tags,
        metadata: {
          ...entry.metadata,
          type: entry.type,
          taskId,
          agentId,
        },
      });
      logger.debug(`Stored truth score for task ${taskId}`);
      return entry.id;
    } catch (error) {
      logger.error('Failed to store truth score:', error);
      return '';
    }
  }

  /**
   * Store verification result in memory
   */
  async storeVerificationResult(result: VerificationResult): Promise<string> {
    const entry: VerificationHistoryEntry = {
      id: `verification-${result.id}`,
      type: 'verification_result',
      taskId: result.pipelineId,
      data: {
        status: result.status,
        passed: result.passed,
        score: result.score,
        duration: result.duration,
        checkpointResults: result.checkpointResults,
      },
      timestamp: result.timestamp,
      tags: [
        'verification-result',
        `status:${result.status}`,
        result.passed ? 'passed' : 'failed',
      ],
      metadata: {},
    };

    try {
      await this.memoryService.store({
        key: entry.id,
        content: JSON.stringify(entry.data),
        tags: entry.tags,
        metadata: {
          type: entry.type,
          pipelineId: result.pipelineId,
        },
      });
      logger.debug(`Stored verification result ${result.id}`);
      return entry.id;
    } catch (error) {
      logger.error('Failed to store verification result:', error);
      return '';
    }
  }

  /**
   * Store deception patterns in memory
   */
  async storeDeceptionPatterns(
    taskId: string,
    agentId: string,
    patterns: DeceptionPattern[],
    actionTaken: string
  ): Promise<string> {
    if (!this.config.enableDeceptionTracking) {
      return '';
    }

    const maxSeverity = Math.max(...patterns.map((p) => p.severity));
    const entry: DeceptionEntry = {
      id: `deception-${taskId}-${Date.now()}`,
      type: 'deception_pattern',
      taskId,
      agentId,
      data: {
        patterns,
        severity: maxSeverity,
        actionTaken,
      },
      timestamp: new Date(),
      tags: [
        'deception',
        `agent:${agentId}`,
        `severity:${maxSeverity > 0.7 ? 'high' : maxSeverity > 0.4 ? 'medium' : 'low'}`,
        ...patterns.map((p) => `type:${p.type}`),
      ],
      metadata: {},
    };

    try {
      await this.memoryService.store({
        key: entry.id,
        content: JSON.stringify(entry.data),
        tags: entry.tags,
        metadata: {
          type: entry.type,
          taskId,
          agentId,
          severity: maxSeverity,
        },
      });
      logger.debug(`Stored deception patterns for task ${taskId}`);
      return entry.id;
    } catch (error) {
      logger.error('Failed to store deception patterns:', error);
      return '';
    }
  }

  /**
   * Get agent reliability score based on historical truth scores
   */
  async getAgentReliability(agentId: string): Promise<{
    reliability: number;
    totalTasks: number;
    passedTasks: number;
    avgTruthScore: number;
    deceptionCount: number;
  }> {
    try {
      // Search for all truth scores for this agent
      const truthResults = await this.memoryService.search(`agent:${agentId} truth-score`);
      const deceptionResults = await this.memoryService.search(`agent:${agentId} deception`);

      const truthScores = truthResults?.map((r: any) => {
        try {
          return JSON.parse(r.entry?.content || r.content || '{}');
        } catch {
          return { score: 0.5 };
        }
      }) || [];

      const avgTruthScore =
        truthScores.length > 0
          ? truthScores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / truthScores.length
          : 1.0;

      const passedTasks = truthScores.filter((s: any) => (s.score || 0) >= 0.8).length;

      return {
        reliability: avgTruthScore,
        totalTasks: truthScores.length,
        passedTasks,
        avgTruthScore,
        deceptionCount: deceptionResults?.length || 0,
      };
    } catch (error) {
      logger.debug('Could not calculate agent reliability:', error);
      return {
        reliability: 1.0,
        totalTasks: 0,
        passedTasks: 0,
        avgTruthScore: 1.0,
        deceptionCount: 0,
      };
    }
  }

  /**
   * Get recent verification history for a task
   */
  async getTaskHistory(
    taskId: string,
    limit = 10
  ): Promise<VerificationMemoryEntry[]> {
    try {
      const results = await this.memoryService.search(`task:${taskId}`);
      return (results || [])
        .slice(0, limit)
        .map((r: any) => {
          try {
            return {
              ...JSON.parse(r.entry?.content || r.content || '{}'),
              id: r.key || r.id,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      logger.debug('Could not retrieve task history:', error);
      return [];
    }
  }

  /**
   * Search verification memory semantically
   */
  async semanticSearch(
    query: string,
    limit = 10
  ): Promise<Array<{ entry: VerificationMemoryEntry; score: number }>> {
    try {
      const results = await this.memoryService.semanticSearch?.(query, limit) ||
        await this.memoryService.search(query);

      return (results || []).map((r: any) => ({
        entry: {
          id: r.key || r.id,
          ...JSON.parse(r.entry?.content || r.content || '{}'),
        },
        score: r.score || 0.5,
      }));
    } catch (error) {
      logger.debug('Semantic search failed:', error);
      return [];
    }
  }

  /**
   * Cleanup old entries beyond retention period
   */
  async cleanup(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    try {
      const entries = await this.memoryService.list?.() || [];
      let removedCount = 0;

      for (const entry of entries) {
        const entryDate = new Date(entry.timestamp || entry.createdAt || 0);
        if (entryDate < cutoffDate) {
          await this.memoryService.delete(entry.id || entry.key);
          removedCount++;
        }
      }

      logger.info(`Cleaned up ${removedCount} old verification entries`);
      return removedCount;
    } catch (error) {
      logger.error('Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Get integration status
   */
  getStatus(): {
    initialized: boolean;
    memoryAvailable: boolean;
    usingFallback: boolean;
    config: MemoryIntegrationConfig;
  } {
    return {
      initialized: this.isInitialized,
      memoryAvailable: !!this.memoryModule,
      usingFallback: !this.memoryModule,
      config: this.config,
    };
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.memoryService?.close) {
      await this.memoryService.close();
    }
    this.isInitialized = false;
    logger.info('Verification memory integration shutdown complete');
  }
}

// ===== Singleton Instance =====

let defaultIntegration: VerificationMemoryIntegration | null = null;

export function getDefaultMemoryIntegration(): VerificationMemoryIntegration {
  if (!defaultIntegration) {
    defaultIntegration = new VerificationMemoryIntegration();
  }
  return defaultIntegration;
}

export async function initializeMemoryIntegration(
  config?: Partial<MemoryIntegrationConfig>
): Promise<VerificationMemoryIntegration> {
  const integration = new VerificationMemoryIntegration(config);
  await integration.initialize();
  defaultIntegration = integration;
  return integration;
}
