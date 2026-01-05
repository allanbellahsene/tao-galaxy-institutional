// ===== GLOBAL CACHE SERVICE =====
// Intelligent caching layer with TTL, LRU eviction, and reactive updates
// Eliminates duplicate API calls and improves performance across the application

import { storageService, StorageError } from './StorageService';

/**
 * Cache entry with metadata for TTL and LRU management
 */
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  lastAccessed: number;
  ttl: number; // Time to live in milliseconds
  isLoading?: boolean;
  error?: StorageError | Error | null;
}

/**
 * Subscription callback for reactive updates
 */
type SubscriptionCallback<T = any> = (data: T | null, error?: StorageError | Error | null, isLoading?: boolean) => void;

/**
 * Cache configuration options
 */
interface CacheConfig {
  defaultTTL: number; // Default 30 minutes for core data
  maxEntries: number; // LRU eviction limit
  backgroundRefresh: boolean; // Enable background refresh
  staleWhileRevalidate: boolean; // Serve stale data while fetching fresh
}

/**
 * Cache keys for core application data
 */
export const CACHE_KEYS = {
  // Core data (high priority - load once, cache long)
  SUBNETS_FRONTEND_READY: 'subnets_frontend_ready',
  SUBNET_EMISSIONS: 'subnet_emissions', 
  SUBNET_PRICES: 'subnet_prices',
  SUBNET_PERCENTILES: 'subnet_percentiles',
  
  // Dynamic reports (medium priority - cache after first access)
  ONE_PAGER: (subnetId: string) => `one_pager_${subnetId}`,
  DEEP_RESEARCH: (subnetId: string) => `deep_research_${subnetId}`,
  COMPETITIVE_ANALYSIS: (subnetId: string) => `competitive_analysis_${subnetId}`,
} as const;

/**
 * TTL configurations for different data types
 */
export const CACHE_TTL = {
  CORE_DATA: 30 * 60 * 1000, // 30 minutes
  REPORTS: 2 * 60 * 1000, // 2 minutes for one-pager reports
  STATIC_DATA: 24 * 60 * 60 * 1000, // 24 hours for rarely changing data
} as const;

/**
 * Global Cache Service - Singleton pattern for application-wide caching
 * Provides intelligent caching with TTL, LRU eviction, and reactive updates
 */
class CacheService {
  private static instance: CacheService;
  private cache = new Map<string, CacheEntry>();
  private subscribers = new Map<string, Set<SubscriptionCallback>>();
  private refreshTimers = new Map<string, NodeJS.Timeout>();
  
  private config: CacheConfig = {
    defaultTTL: CACHE_TTL.CORE_DATA,
    maxEntries: 1000, // Reasonable limit for LRU eviction
    backgroundRefresh: true,
    staleWhileRevalidate: true,
  };

  private constructor() {
    // Singleton - private constructor
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get data from cache or fetch if not available/expired
   * Implements stale-while-revalidate pattern for better UX
   */
  async get<T>(
    key: string, 
    fetcher: (bypassCache?: boolean) => Promise<T>, 
    ttl: number = this.config.defaultTTL
  ): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();
    
    // Update last accessed for LRU
    if (entry) {
      entry.lastAccessed = now;
    }
    
    // Return fresh data if available and not expired
    if (entry && !this.isExpired(entry)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🟢 CacheService: Cache HIT for ${key}`);
      }
      return entry.data;
    }
    
    // Handle concurrent requests - prevent duplicate fetching
    if (entry?.isLoading) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🟡 CacheService: Waiting for concurrent fetch of ${key}`);
      }
      return this.waitForLoading<T>(key);
    }
    
    // Stale-while-revalidate: return stale data immediately, fetch fresh in background
    if (entry && this.config.staleWhileRevalidate && entry.data) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🟠 CacheService: Serving STALE data for ${key}, refreshing in background`);
      }
      this.backgroundFetch(key, fetcher, ttl); // Non-blocking background refresh
      return entry.data;
    }
    
    // No cache or expired - fetch fresh data
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔴 CacheService: Cache MISS for ${key}, fetching fresh data`);
    }
    return this.fetchAndCache(key, fetcher, ttl);
  }

  /**
   * Fetch data and update cache with loading states
   */
  private async fetchAndCache<T>(
    key: string,
    fetcher: (bypassCache?: boolean) => Promise<T>,
    ttl: number
  ): Promise<T> {
    const now = Date.now();
    
    // Set loading state
    const loadingEntry: CacheEntry<T> = {
      data: null as any,
      timestamp: now,
      lastAccessed: now,
      ttl,
      isLoading: true,
      error: null,
    };
    this.cache.set(key, loadingEntry);
    this.notifySubscribers(key, null, null, true);
    
    try {
      // Use bypass cache for initial fetch to ensure fresh data from database
      const data = await fetcher(true);
      
      // Update cache with fresh data
      const successEntry: CacheEntry<T> = {
        data,
        timestamp: now,
        lastAccessed: now,
        ttl,
        isLoading: false,
        error: null,
      };
      this.cache.set(key, successEntry);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ CacheService: Successfully cached ${key} (TTL: ${ttl}ms)`);
      }
      this.notifySubscribers(key, data, null, false);
      
      // Setup background refresh timer if enabled
      if (this.config.backgroundRefresh) {
        this.scheduleBackgroundRefresh(key, fetcher, ttl);
      }
      
      // Enforce cache size limit with LRU eviction
      this.enforceMaxEntries();
      
      return data;
      
    } catch (error) {
      const errorEntry: CacheEntry<T> = {
        data: null as any,
        timestamp: now,
        lastAccessed: now,
        ttl: 5 * 60 * 1000, // Short TTL for errors (5 minutes)
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
      this.cache.set(key, errorEntry);
      
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ CacheService: Error caching ${key}:`, error);
      }
      this.notifySubscribers(key, null, error instanceof Error ? error : new Error(String(error)), false);
      
      throw error;
    }
  }

  /**
   * Background fetch without blocking current request
   * Uses bypassCache=true to ensure truly fresh data when TTL expires
   */
  private async backgroundFetch<T>(
    key: string,
    fetcher: (bypassCache?: boolean) => Promise<T>,
    ttl: number
  ): Promise<void> {
    try {
      // Force fresh data fetch by bypassing browser cache
      const data = await fetcher(true);
      const now = Date.now();
      
      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        lastAccessed: now,
        ttl,
        isLoading: false,
        error: null,
      };
      this.cache.set(key, entry);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 CacheService: Background refresh completed for ${key} (bypassed cache)`);
      }
      this.notifySubscribers(key, data, null, false);
      
      // Schedule the next background refresh to continue the cycle
      this.scheduleBackgroundRefresh(key, fetcher, ttl);
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ CacheService: Background refresh failed for ${key}:`, error);
      }
      // Don't update cache on background refresh failure - keep serving stale data
      // But still schedule next refresh attempt
      this.scheduleBackgroundRefresh(key, fetcher, ttl);
    }
  }

  /**
   * Wait for concurrent loading to complete
   */
  private async waitForLoading<T>(key: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const checkLoading = () => {
        const entry = this.cache.get(key);
        if (!entry?.isLoading) {
          if (entry?.error) {
            reject(entry.error);
          } else if (entry?.data) {
            resolve(entry.data);
          } else {
            reject(new Error(`Cache entry for ${key} in invalid state`));
          }
        } else {
          setTimeout(checkLoading, 100); // Check every 100ms
        }
      };
      checkLoading();
    });
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Schedule automatic background refresh
   */
  private scheduleBackgroundRefresh<T>(
    key: string,
    fetcher: (bypassCache?: boolean) => Promise<T>,
    ttl: number
  ): void {
    // Clear existing timer
    const existingTimer = this.refreshTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Schedule refresh at 90% of TTL to avoid expiration
    const refreshTime = ttl * 0.9;
    const timer = setTimeout(() => {
      this.backgroundFetch(key, fetcher, ttl);
    }, refreshTime);
    
    this.refreshTimers.set(key, timer);
    if (process.env.NODE_ENV === 'development') {
      console.log(`⏰ CacheService: Scheduled background refresh for ${key} in ${refreshTime}ms`);
    }
  }

  /**
   * LRU eviction to maintain cache size limit
   */
  private enforceMaxEntries(): void {
    if (this.cache.size <= this.config.maxEntries) {
      return;
    }
    
    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest entries until under limit
    const entriesToRemove = entries.slice(0, this.cache.size - this.config.maxEntries);
    
    for (const [key] of entriesToRemove) {
      this.cache.delete(key);
      this.clearRefreshTimer(key);
      if (process.env.NODE_ENV === 'development') {
        console.log(`🗑️ CacheService: Evicted ${key} due to LRU policy`);
      }
    }
  }

  /**
   * Subscribe to cache updates for reactive components
   */
  subscribe<T>(key: string, callback: SubscriptionCallback<T>): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)!.add(callback);
    
    // Immediately notify with current cached data if available
    const entry = this.cache.get(key);
    if (entry) {
      callback(entry.data, entry.error, entry.isLoading);
    }
    
    // Return unsubscribe function
    return () => {
      const keySubscribers = this.subscribers.get(key);
      if (keySubscribers) {
        keySubscribers.delete(callback);
        if (keySubscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  /**
   * Notify all subscribers of cache updates
   */
  private notifySubscribers<T>(
    key: string, 
    data: T | null, 
    error: StorageError | Error | null = null, 
    isLoading: boolean = false
  ): void {
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      keySubscribers.forEach(callback => {
        try {
          callback(data, error, isLoading);
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`CacheService: Subscriber error for ${key}:`, err);
          }
        }
      });
    }
  }

  /**
   * Manually invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.clearRefreshTimer(key);
    this.notifySubscribers(key, null, null, false);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 CacheService: Invalidated cache for ${key}`);
    }
  }

  /**
   * Clear refresh timer for key
   */
  private clearRefreshTimer(key: string): void {
    const timer = this.refreshTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(key);
    }
  }

  /**
   * Clear entire cache (useful for logout/reset)
   */
  clearAll(): void {
    this.cache.clear();
    
    // Clear all timers
    this.refreshTimers.forEach(timer => clearTimeout(timer));
    this.refreshTimers.clear();
    
    // Notify all subscribers
    this.subscribers.forEach((_, key) => {
      this.notifySubscribers(key, null, null, false);
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 CacheService: Cleared entire cache');
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): {
    size: number;
    entries: Array<{
      key: string;
      size: number;
      age: number;
      lastAccessed: number;
      isExpired: boolean;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: JSON.stringify(entry.data).length,
      age: now - entry.timestamp,
      lastAccessed: now - entry.lastAccessed,
      isExpired: this.isExpired(entry),
    }));
    
    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Preload critical data for faster app initialization
   */
  async preloadCriticalData(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 CacheService: Preloading critical application data...');
    }
    
    const criticalDataLoaders = [
      // Core data that 9+ components need
      () => storageService.fetchSubnetsFrontendReady(),
      // Services data
      () => storageService.fetchSubnetEmissions(),
      () => storageService.fetchSubnetPrices(),
    ];
    
    const criticalKeys = [
      CACHE_KEYS.SUBNETS_FRONTEND_READY,
      CACHE_KEYS.SUBNET_EMISSIONS,
      CACHE_KEYS.SUBNET_PRICES,
    ];
    
    try {
      await Promise.allSettled(
        criticalDataLoaders.map((loader, index) =>
          this.get(criticalKeys[index], loader, CACHE_TTL.CORE_DATA)
        )
      );
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ CacheService: Critical data preloading completed');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ CacheService: Critical data preloading failed:', error);
      }
    }
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();

// Export types for component usage
export type { SubscriptionCallback };
export { CacheService };