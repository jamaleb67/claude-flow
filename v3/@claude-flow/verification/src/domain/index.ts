/**
 * Domain Layer - Core verification domain logic
 * Contains types, interfaces, scorers, and detectors
 *
 * Day 2 migration - selective exports to avoid conflicts
 */

// Core types (primary source of type definitions)
export * from './types.js';

// Core class - DeceptionDetector (fork-unique)
export { DeceptionDetector } from './deception-detector.js';

// Security module
export { SecurityEnforcementSystem } from './security.js';
