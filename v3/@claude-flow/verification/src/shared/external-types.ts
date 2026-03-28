/**
 * External Type Stubs
 *
 * These types provide interfaces for external dependencies.
 * They allow the verification package to compile independently
 * while maintaining type safety at the boundaries.
 *
 * When integrating with actual packages (@claude-flow/memory, @claude-flow/hooks, etc.),
 * these can be replaced with actual imports.
 */

// ===== Logger Interface =====
export interface ILogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  child?(options: Record<string, unknown>): ILogger;
}

export const createLogger = (prefix?: string): ILogger => ({
  info: (msg, ...args) => console.log(`[INFO]${prefix ? ` [${prefix}]` : ''} ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN]${prefix ? ` [${prefix}]` : ''} ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR]${prefix ? ` [${prefix}]` : ''} ${msg}`, ...args),
  debug: (msg, ...args) => console.debug(`[DEBUG]${prefix ? ` [${prefix}]` : ''} ${msg}`, ...args),
  child: (options) => createLogger(options.prefix as string || prefix),
});

export const logger = createLogger();

// ===== Event Bus Interface =====
export interface IEventBus {
  emit(event: string, ...args: unknown[]): boolean;
  on(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
}

// ===== Memory System Interface =====
export interface DistributedMemorySystem {
  store(key: string, value: unknown, options?: MemoryStoreOptions): Promise<void>;
  retrieve(key: string): Promise<unknown | null>;
  search(query: string, options?: MemorySearchOptions): Promise<MemorySearchResult[]>;
  delete(key: string): Promise<boolean>;
}

export interface MemoryStoreOptions {
  namespace?: string;
  ttl?: number;
  tags?: string[];
  type?: string;
  [key: string]: unknown;
}

export interface MemorySearchOptions {
  namespace?: string;
  limit?: number;
  threshold?: number;
}

export interface MemorySearchResult {
  key: string;
  value: unknown;
  data?: any;
  score: number;
  metadata?: Record<string, unknown>;
}

// ===== Swarm Types =====
export interface AgentId {
  id: string;
  swarmId: string;
  type: string;
  instance: number;
}

export interface TaskId {
  id: string;
  swarmId: string;
  sequence: number;
  priority: number;
}

export interface SwarmId {
  id: string;
  namespace: string;
  version: string;
  createdAt: Date;
}

export interface TaskResult {
  taskId: TaskId;
  success: boolean;
  output?: unknown;
  error?: Error;
  duration: number;
}

export interface AgentState {
  id: string;
  agentId: AgentId;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: TaskId;
  lastActive: Date;
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageDuration: number;
  successRate: number;
}

// ===== Error Classes =====
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

// ===== Hook Types =====
export interface AgenticHookContext {
  hookId: string;
  timestamp: number;
  metadata: Record<string, unknown>;
  sessionId?: string;
  correlationId?: string;
}

export interface HookHandlerResult {
  success: boolean;
  data?: unknown;
  error?: string;
  continue?: boolean;
  rollback?: boolean;
  modified?: boolean;
  metadata?: Record<string, unknown>;
}

export interface HookRegistration {
  id: string;
  type: string;
  priority?: number;
  handler: (payload: unknown, ctx: AgenticHookContext) => Promise<HookHandlerResult>;
}

export interface WorkflowHookPayload {
  workflowId: string;
  step: string;
  data: unknown;
  state?: unknown;
  error?: unknown;
}

export interface PerformanceHookPayload {
  metric: string;
  value: number;
  timestamp: number;
  context?: unknown;
  threshold?: number;
}

export interface MemoryHookPayload {
  operation: string;
  key: string;
  value?: unknown;
}

// ===== Agentic Hook Manager =====
export interface IAgenticHookManager {
  register(reg: HookRegistration): Promise<void>;
  unregister(id: string): Promise<void>;
  trigger(hookId: string, payload: unknown): Promise<HookHandlerResult>;
  emit(event: string, ...args: unknown[]): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

export const createAgenticHookManager = (): IAgenticHookManager => ({
  register: async () => {},
  unregister: async () => {},
  trigger: async () => ({ success: true }),
  emit: () => {},
  on: () => {},
});

export const agenticHookManager = createAgenticHookManager();
