// ===== SUPABASE STORAGE CONFIGURATION =====
// Configuration for Supabase Storage URLs and file paths (AUTHENTICATED ACCESS)
// Centralizes all storage-related constants for clean migration

/**
 * Base Supabase Storage URL for authenticated files
 * Format: https://[project-id].supabase.co/storage/v1/object (note: no /public/ for private buckets)
 */
const SUPABASE_STORAGE_BASE_URL = import.meta.env.VITE_SUPABASE_STORAGE_URL;

if (!SUPABASE_STORAGE_BASE_URL) {
  throw new Error('VITE_SUPABASE_STORAGE_URL environment variable is required. Should be: https://[project-id].supabase.co/storage/v1/object');
}

/**
 * Storage bucket name for Tao Galaxy data
 */
const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'tao-galaxy-data';

/**
 * Core static JSON files configuration
 * These are the Phase 1 critical files for immediate migration
 */
export const STORAGE_PATHS = {
  // Phase 1: Critical static files
  CORE_DATA: {
    SUBNETS_FRONTEND_READY: `${STORAGE_BUCKET}/core-data/subnets_frontend_ready.json`,
    SUBNET_EMISSIONS: `${STORAGE_BUCKET}/core-data/subnet_emissions.json`,
    SUBNET_PRICES: `${STORAGE_BUCKET}/core-data/subnet_prices.json`,
    SUBNET_PERCENTILES: `${STORAGE_BUCKET}/core-data/subnet_percentiles.json`,
  },
  
  // Phase 2: Dynamic report files (future migration)
  REPORTS: {
    ONE_PAGER_PATTERN: `${STORAGE_BUCKET}/one-pager-reports/SN{number}_one_pager.json`,
    DEEP_RESEARCH_PATTERN: `${STORAGE_BUCKET}/deep-research/SN{number}_deep_research.json`,
    COMPETITIVE_ANALYSIS_PATTERN: `${STORAGE_BUCKET}/competitive-analysis/SN{number}_competitive_analysis.json`,
    DUE_DILIGENCE_PATTERN: `${STORAGE_BUCKET}/due-diligence/SN{number}_due_diligence.json`,
    AUDIT_PATTERN: `${STORAGE_BUCKET}/audits/SN{number}_audit.json`,
  },

  // Insights data (migrated to buckets)
  INSIGHTS: {
    ALL_INSIGHTS: `${STORAGE_BUCKET}/insights-data/all_insights.json`,
    SUBNET_INSIGHTS_PATTERN: `${STORAGE_BUCKET}/insights-data/SN{number}_insights.json`,
  },

  // Discord messages data (migrated to buckets)
  DISCORD_DATA: {
    SUBNET_MESSAGES_PATTERN: `${STORAGE_BUCKET}/discord-data/SN{number}_messages.json`,
  },

  // Summaries data (migrated to buckets)
  SUMMARIES: {
    SUBNET_SUMMARY_PATTERN: `${STORAGE_BUCKET}/summaries-data/SN{number}_summary.txt`,
  }
} as const;

/**
 * Configuration options for storage behavior
 */
export const STORAGE_CONFIG = {
  // Base URL for Supabase Storage
  BASE_URL: SUPABASE_STORAGE_BASE_URL,
  
  // Bucket name
  BUCKET: STORAGE_BUCKET,
  
  // Cache busting for dynamic content (like prices)
  ENABLE_CACHE_BUSTING: true,
  
  // Request timeout in milliseconds
  REQUEST_TIMEOUT: 10000,
  
  // Retry attempts for failed requests
  MAX_RETRIES: 3,
} as const;

/**
 * Helper function to build complete Supabase Storage URLs
 */
export function buildStorageUrl(path: string): string {
  const baseUrl = STORAGE_CONFIG.BASE_URL.endsWith('/') 
    ? STORAGE_CONFIG.BASE_URL.slice(0, -1) 
    : STORAGE_CONFIG.BASE_URL;
  
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  return `${baseUrl}/${cleanPath}`;
}

/**
 * Generate smart timestamp for cache busting that only changes when data might be stale
 * @param ttlMs - TTL in milliseconds (from CACHE_TTL constants)
 * @returns Timestamp rounded down to nearest TTL interval
 */
export function getSmartTimestamp(ttlMs: number): number {
  const now = new Date().getTime();
  return Math.floor(now / ttlMs) * ttlMs;
}

/**
 * Generate current timestamp for aggressive cache busting
 * Forces fresh data fetch by bypassing all cache layers
 * @returns Current timestamp in milliseconds
 */
export function getCurrentTimestamp(): number {
  return new Date().getTime();
}

/**
 * Helper function to build URLs with TTL-aware cache busting for dynamic content
 * @param path - Storage path
 * @param ttlMs - TTL in milliseconds (from CACHE_TTL constants)
 * @param bypassCache - Force fresh data by using current timestamp (default: false)
 */
export function buildStorageUrlWithCacheBusting(
  path: string, 
  ttlMs: number, 
  bypassCache: boolean = false
): string {
  const url = buildStorageUrl(path);
  
  if (STORAGE_CONFIG.ENABLE_CACHE_BUSTING) {
    const separator = url.includes('?') ? '&' : '?';
    const timestamp = bypassCache ? getCurrentTimestamp() : getSmartTimestamp(ttlMs);
    return `${url}${separator}t=${timestamp}`;
  }
  
  return url;
}

/**
 * Helper function to build dynamic report URLs
 * Replaces {number} pattern with actual subnet number
 */
export function buildReportUrl(pattern: string, subnetId: string): string {
  const subnetNumber = subnetId.replace('SN', '');
  const path = pattern.replace('{number}', subnetNumber);
  return buildStorageUrl(path);
}

// Type definitions for storage configuration
export type StoragePath = keyof typeof STORAGE_PATHS.CORE_DATA;
export type ReportPattern = keyof typeof STORAGE_PATHS.REPORTS;
export type InsightsPattern = keyof typeof STORAGE_PATHS.INSIGHTS;
export type DiscordDataPattern = keyof typeof STORAGE_PATHS.DISCORD_DATA;
export type SummariesPattern = keyof typeof STORAGE_PATHS.SUMMARIES;
