// ===== SUPABASE STORAGE SERVICE =====
// Centralized service for fetching JSON files from Supabase Storage
// Provides a clean interface for all storage operations with authentication when available

import { 
  STORAGE_PATHS, 
  STORAGE_CONFIG,
  buildStorageUrl,
  buildStorageUrlWithCacheBusting,
  buildReportUrl,
  type StoragePath,
  type ReportPattern,
  type InsightsPattern
} from '../config/storage.config';
import { supabase } from '../lib/supabase';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Error class for storage-related operations
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status?: number,
    public readonly operation?: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Retry configuration for failed requests
 */
interface RetryConfig {
  maxRetries: number;
  delay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: STORAGE_CONFIG.MAX_RETRIES,
  delay: 1000,
  backoffMultiplier: 2
};

/**
 * Supabase Storage Service - Singleton pattern for consistent data fetching
 */
class StorageService {
  private static instance: StorageService;
  
  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Get authentication headers for authenticated requests
   * @param bypassCache - Add cache-control headers to bypass browser cache
   */
  private async getAuthHeaders(bypassCache: boolean = false): Promise<Record<string, string>> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new StorageError(
        `Authentication error: ${error.message}`,
        '',
        undefined,
        'get auth headers'
      );
    }
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else if (supabaseAnonKey) {
      headers['apikey'] = supabaseAnonKey;
    } else {
      throw new StorageError(
        'No valid session or anon key available to access storage.',
        '',
        401,
        'authentication required'
      );
    }

    if (supabaseAnonKey) {
      headers['apikey'] = supabaseAnonKey;
    }
    
    // Add cache-control headers
    if (bypassCache) {
      // Force fresh data - bypass all caches
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    } else {
      // Allow browser caching for 24 hours
      headers['Cache-Control'] = 'public, max-age=86400'; // 24 hours = 86400 seconds
    }
    
    return headers;
  }

  /**
   * Generic fetch method with retry logic, authentication, and proper error handling
   * @param bypassCache - Bypass browser cache for truly fresh data
   */
  private async fetchWithRetry<T>(
    url: string, 
    operation: string,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
    bypassCache: boolean = false
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Get fresh auth headers for each attempt (with cache control if bypassing)
        const headers = await this.getAuthHeaders(bypassCache);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), STORAGE_CONFIG.REQUEST_TIMEOUT);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Special handling for auth errors
          if (response.status === 401 || response.status === 403) {
            throw new StorageError(
              `Access denied: ${response.statusText}. Sign in or verify this resource is public.`,
              url,
              response.status,
              operation
            );
          }
          
          throw new StorageError(
            `HTTP ${response.status}: ${response.statusText}`,
            url,
            response.status,
            operation
          );
        }
        
        const data = await response.json();
        
        // Log successful fetch in development only
        if (process.env.NODE_ENV === 'development') {
          const cacheStatus = bypassCache ? '(bypassed cache)' : '(used cache if available)';
          console.log(`✅ StorageService: Successfully fetched ${operation} from Supabase Storage ${cacheStatus}`);
        }
        
        return data as T;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on certain errors
        if (error instanceof StorageError && (
          error.status === 404 || 
          error.status === 401 || 
          error.status === 403
        )) {
          throw error;
        }
        
        if (attempt < retryConfig.maxRetries) {
          const delay = retryConfig.delay * Math.pow(retryConfig.backoffMultiplier, attempt);
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ StorageService: Retry ${attempt + 1}/${retryConfig.maxRetries} for ${operation} in ${delay}ms`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ StorageService: Failed to fetch ${operation} after ${retryConfig.maxRetries} retries`);
    }
    throw new StorageError(
      `Failed to fetch ${operation}: ${lastError.message}`,
      url,
      lastError instanceof StorageError ? lastError.status : undefined,
      operation
    );
  }

  /**
   * Derive list of subnet IDs from subnets_frontend_ready dataset.
   * Uses Supabase storage data instead of a separate API.
   */
  private async fetchSubnetsData(bypassCache: boolean = false): Promise<{ subnets: Array<{ subnet_id: string }> }> {
    try {
      const categories = await this.fetchSubnetsFrontendReady<any[]>(bypassCache);

      if (!Array.isArray(categories)) {
        throw new Error('Invalid subnets_frontend_ready payload: expected array.');
      }

      const seen = new Set<string>();
      const normalizedSubnets: Array<{ subnet_id: string }> = [];

      for (const category of categories) {
        const subnets = Array.isArray(category?.subnets) ? category.subnets : [];

        for (const subnet of subnets) {
          const rawId = typeof subnet?.id === 'string' ? subnet.id.trim() : '';
          if (!rawId) continue;

          let normalized = rawId.toUpperCase();

          if (!/^SN\d+$/.test(normalized)) {
            const digits = rawId.match(/\d+/);
            if (!digits) continue;
            normalized = `SN${digits[0]}`;
          }

          if (!seen.has(normalized)) {
            seen.add(normalized);
            normalizedSubnets.push({ subnet_id: normalized });
          }
        }
      }

      return { subnets: normalizedSubnets };
    } catch (error) {
      throw new Error(`Failed to load subnet metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch core static JSON files
   */
  async fetchCoreData<T>(path: StoragePath): Promise<T> {
    const storagePath = STORAGE_PATHS.CORE_DATA[path];
    const url = buildStorageUrl(storagePath);
    
    return this.fetchWithRetry<T>(url, `core data: ${path}`);
  }

  /**
   * Fetch core static JSON files with TTL-aware cache busting (for frequently updated data)
   * @param path - Storage path to fetch
   * @param ttlMs - TTL in milliseconds for cache busting intervals
   * @param bypassCache - Force fresh data by bypassing browser cache
   */
  async fetchCoreDataWithCacheBusting<T>(
    path: StoragePath, 
    ttlMs: number, 
    bypassCache: boolean = false
  ): Promise<T> {
    const storagePath = STORAGE_PATHS.CORE_DATA[path];
    const url = buildStorageUrlWithCacheBusting(storagePath, ttlMs, bypassCache);
    
    return this.fetchWithRetry<T>(
      url, 
      `core data with TTL cache busting: ${path} (${ttlMs}ms TTL)`, 
      DEFAULT_RETRY_CONFIG, 
      bypassCache
    );
  }

  /**
   * Fetch dynamic report files (one-pagers, deep research, etc.)
   */
  async fetchReport<T>(pattern: ReportPattern, subnetId: string): Promise<T> {
    const reportPattern = STORAGE_PATHS.REPORTS[pattern];
    const url = buildReportUrl(reportPattern, subnetId);
    
    console.log(`🔍 fetchReport details:`, {
      pattern,
      subnetId,
      reportPattern,
      finalUrl: url
    });
    
    return this.fetchWithRetry<T>(url, `report: ${pattern} for ${subnetId}`);
  }

  // ===== SPECIFIC METHODS FOR PHASE 1 MIGRATION =====

  /**
   * Fetch main subnets data (most critical file)
   */
  async fetchSubnetsFrontendReady<T>(bypassCache: boolean = false): Promise<T> {
    if (bypassCache) {
      // Import CACHE_TTL for TTL-aware cache busting
      const { CACHE_TTL } = await import('./CacheService');
      return this.fetchCoreDataWithCacheBusting<T>('SUBNETS_FRONTEND_READY', CACHE_TTL.CORE_DATA, true);
    }
    return this.fetchCoreData<T>('SUBNETS_FRONTEND_READY');
  }

  /**
   * Fetch emissions data for EmissionsDataService
   */
  async fetchSubnetEmissions<T>(bypassCache: boolean = false): Promise<T> {
    if (bypassCache) {
      const { CACHE_TTL } = await import('./CacheService');
      return this.fetchCoreDataWithCacheBusting<T>('SUBNET_EMISSIONS', CACHE_TTL.CORE_DATA, true);
    }
    return this.fetchCoreData<T>('SUBNET_EMISSIONS');
  }

  /**
   * Fetch price data for PriceDataService (with TTL-aware cache busting)
   */
  async fetchSubnetPrices<T>(bypassCache: boolean = false): Promise<T> {
    const { CACHE_TTL } = await import('./CacheService');
    return this.fetchCoreDataWithCacheBusting<T>('SUBNET_PRICES', CACHE_TTL.CORE_DATA, bypassCache);
  }

  /**
   * Fetch percentiles data for SubnetReport
   */
  async fetchSubnetPercentiles<T>(bypassCache: boolean = false): Promise<T> {
    if (bypassCache) {
      const { CACHE_TTL } = await import('./CacheService');
      return this.fetchCoreDataWithCacheBusting<T>('SUBNET_PERCENTILES', CACHE_TTL.CORE_DATA, true);
    }
    return this.fetchCoreData<T>('SUBNET_PERCENTILES');
  }

  /**
   * Fetch one-pager report for a specific subnet
   */
  async fetchOnePagerReport<T>(subnetId: string, bypassCache: boolean = false): Promise<T> {
    if (bypassCache) {
      const { CACHE_TTL } = await import('./CacheService');
      const reportPattern = STORAGE_PATHS.REPORTS['ONE_PAGER_PATTERN'];
      const reportPath = reportPattern.replace('{number}', subnetId.replace('SN', ''));
      const url = buildStorageUrlWithCacheBusting(reportPath, CACHE_TTL.REPORTS, true);
      return this.fetchWithRetry<T>(url, `one-pager report for ${subnetId} (bypassed cache)`, DEFAULT_RETRY_CONFIG, true);
    }
    return this.fetchReport<T>('ONE_PAGER_PATTERN', subnetId);
  }

  /**
   * Fetch deep research report for a specific subnet
   */
  async fetchDeepResearchReport<T>(subnetId: string, bypassCache: boolean = false): Promise<T> {
    if (bypassCache) {
      const { CACHE_TTL } = await import('./CacheService');
      const reportPattern = STORAGE_PATHS.REPORTS['DEEP_RESEARCH_PATTERN'];
      const reportPath = reportPattern.replace('{number}', subnetId.replace('SN', ''));
      const url = buildStorageUrlWithCacheBusting(reportPath, CACHE_TTL.REPORTS, true);
      return this.fetchWithRetry<T>(url, `deep research report for ${subnetId} (bypassed cache)`, DEFAULT_RETRY_CONFIG, true);
    }
    return this.fetchReport<T>('DEEP_RESEARCH_PATTERN', subnetId);
  }

  /**
   * Fetch competitive analysis report for a specific subnet
   */
  async fetchCompetitiveAnalysisReport<T>(subnetId: string, bypassCache: boolean = false): Promise<T> {
    if (bypassCache) {
      const { CACHE_TTL } = await import('./CacheService');
      const reportPattern = STORAGE_PATHS.REPORTS['COMPETITIVE_ANALYSIS_PATTERN'];
      const reportPath = reportPattern.replace('{number}', subnetId.replace('SN', ''));
      const url = buildStorageUrlWithCacheBusting(reportPath, CACHE_TTL.REPORTS, true);
      return this.fetchWithRetry<T>(url, `competitive analysis report for ${subnetId} (bypassed cache)`, DEFAULT_RETRY_CONFIG, true);
    }
    return this.fetchReport<T>('COMPETITIVE_ANALYSIS_PATTERN', subnetId);
  }

  /**
   * Quick check if a due diligence report exists (with short timeout)
   */
  async checkDueDiligenceReportExists(subnetId: string): Promise<boolean> {
    try {
      const reportPattern = STORAGE_PATHS.REPORTS['DUE_DILIGENCE_PATTERN'];
      const subnetNumber = subnetId.replace('SN', '');
      const reportPath = reportPattern.replace('{number}', subnetNumber);
      const url = buildStorageUrl(reportPath);
      
      const headers = await this.getAuthHeaders(false);
      const controller = new AbortController();
      // Use very short timeout for existence check
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const response = await fetch(url, {
        method: 'HEAD', // Use HEAD request for efficiency
        signal: controller.signal,
        headers
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch due diligence report for a specific subnet
   */
  async fetchDueDiligenceReport<T>(subnetId: string, bypassCache: boolean = false): Promise<T> {
    console.log(`🔍 StorageService.fetchDueDiligenceReport called with subnetId: "${subnetId}", bypassCache: ${bypassCache}`);
    
    if (bypassCache) {
      const { CACHE_TTL } = await import('./CacheService');
      const reportPattern = STORAGE_PATHS.REPORTS['DUE_DILIGENCE_PATTERN'];
      const subnetNumber = subnetId.replace('SN', '');
      const reportPath = reportPattern.replace('{number}', subnetNumber);
      const url = buildStorageUrlWithCacheBusting(reportPath, CACHE_TTL.REPORTS, true);
      
      console.log(`🔍 Bypass cache path construction:`, {
        subnetId,
        subnetNumber,
        reportPattern,
        reportPath,
        finalUrl: url
      });
      
      return this.fetchWithRetry<T>(url, `deep dive report for ${subnetId} (bypassed cache)`, DEFAULT_RETRY_CONFIG, true);
    }
    
    console.log(`🔍 Using normal fetchReport for subnetId: "${subnetId}"`);
    return this.fetchReport<T>('DUE_DILIGENCE_PATTERN', subnetId);
  }

  /**
   * Fetch audit report for a specific subnet
   */
  async fetchAuditReport<T>(subnetId: string, bypassCache: boolean = false): Promise<T> {
    console.log(`🔍 StorageService.fetchAuditReport called with subnetId: "${subnetId}", bypassCache: ${bypassCache}`);

    if (bypassCache) {
      const { CACHE_TTL } = await import('./CacheService');
      const reportPattern = STORAGE_PATHS.REPORTS['AUDIT_PATTERN'];
      const subnetNumber = subnetId.replace('SN', '');
      const reportPath = reportPattern.replace('{number}', subnetNumber);
      const url = buildStorageUrlWithCacheBusting(reportPath, CACHE_TTL.REPORTS, true);

      console.log(`🔍 Audit report path construction:`, {
        subnetId,
        subnetNumber,
        reportPattern,
        reportPath,
        finalUrl: url
      });

      return this.fetchWithRetry<T>(url, `audit report for ${subnetId} (bypassed cache)`, DEFAULT_RETRY_CONFIG, true);
    }

    console.log(`🔍 Using normal fetchReport for subnetId: "${subnetId}"`);
    return this.fetchReport<T>('AUDIT_PATTERN', subnetId);
  }

  // ===== INSIGHTS METHODS =====

  /**
   * Fetch all insights from all subnets (aggregated from individual subnet files)
   */
  async fetchAllInsights<T>(bypassCache: boolean = false): Promise<T> {
    const aggregatePath = `${STORAGE_CONFIG.BUCKET}/insights-data/aggregate.json`;
    const aggregateUrl = buildStorageUrlWithCacheBusting(aggregatePath, 5 * 60 * 1000, bypassCache);

    try {
      const aggregate = await this.fetchWithRetry<Record<string, any[]>>(
        aggregateUrl,
        'insights aggregate',
        DEFAULT_RETRY_CONFIG,
        bypassCache
      );

      const allInsights: any[] = [];
      Object.values(aggregate || {}).forEach((entries) => {
        if (Array.isArray(entries)) {
          allInsights.push(...entries);
        }
      });

      allInsights.sort((a, b) => {
        const dateA = new Date(a?.date || 0).getTime();
        const dateB = new Date(b?.date || 0).getTime();
        return dateB - dateA;
      });

      console.log(`Loaded ${allInsights.length} insights from aggregate snapshot`);
      return allInsights as T;
    } catch (error) {
      console.warn('Aggregate insights not available, falling back to per-subnet fetch.', error);

      // Legacy fallback
      try {
        const subnetsData = await this.fetchSubnetsData(bypassCache);
        const subnetIds = subnetsData.subnets.map((subnet: any) => subnet.subnet_id);

        const allInsights: any[] = [];
        const fetchPromises = subnetIds.map(async (subnetId: string) => {
          try {
            const subnetInsights = await this.fetchSubnetInsights<any[]>(subnetId, bypassCache);
            return subnetInsights || [];
          } catch (subnetError) {
            console.log(`No insights found for ${subnetId} (this is normal)`);
            return [];
          }
        });

        const subnetInsightsArrays = await Promise.all(fetchPromises);
        subnetInsightsArrays.forEach((insights) => allInsights.push(...insights));

        allInsights.sort((a, b) => {
          const dateA = new Date(a?.date || 0).getTime();
          const dateB = new Date(b?.date || 0).getTime();
          return dateB - dateA;
        });

        return allInsights as T;
      } catch (fallbackError) {
        console.error('Error fetching aggregated insights:', fallbackError);
        throw new Error(`Failed to fetch all insights: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Fetch insights for a specific subnet
   */
  async fetchSubnetInsights<T>(subnetId: string, bypassCache: boolean = false): Promise<T> {
    const pattern = STORAGE_PATHS.INSIGHTS['SUBNET_INSIGHTS_PATTERN'];
    const subnetNumber = subnetId.replace('SN', '');
    const insightsPath = pattern.replace('{number}', subnetNumber);

    const url = bypassCache
      ? buildStorageUrlWithCacheBusting(insightsPath, 3600000, true) // 1 hour TTL, bypass cache
      : buildStorageUrl(insightsPath);

    return this.fetchWithRetry<T>(url, `insights for ${subnetId}`, DEFAULT_RETRY_CONFIG, bypassCache);
  }

  /**
   * Health check method to verify Supabase Storage connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch the most critical file to verify connectivity
      await this.fetchSubnetsFrontendReady();
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ StorageService: Health check passed - Supabase Storage is accessible');
      }
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ StorageService: Health check failed - Supabase Storage is not accessible', error);
      }
      return false;
    }
  }
}

// Export singleton instance
export const storageService = StorageService.getInstance();

// Export the class for testing purposes
export { StorageService };
