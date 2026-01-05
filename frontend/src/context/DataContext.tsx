// ===== GLOBAL DATA CONTEXT =====
// Provides globally cached core application data using CacheService
// Eliminates duplicate API calls by providing shared data access

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { cacheService, CACHE_KEYS, CACHE_TTL, SubscriptionCallback } from '../services/CacheService';
import { storageService, StorageError } from '../services/StorageService';
import { CategoryType } from '../types';

/**
 * Core application data that is shared across multiple components
 */
interface CoreData {
  // Primary data (used by 9+ components)
  subnetsData: CategoryType[] | null;
  
  // Supporting data (used by services and specific components)
  emissionsData: any | null;
  pricesData: any | null;
  percentilesData: any | null;
}

/**
 * Loading states for each data type
 */
interface LoadingStates {
  subnetsData: boolean;
  emissionsData: boolean;
  pricesData: boolean;
  percentilesData: boolean;
}

/**
 * Error states for each data type
 */
interface ErrorStates {
  subnetsData: StorageError | Error | null;
  emissionsData: StorageError | Error | null;
  pricesData: StorageError | Error | null;
  percentilesData: StorageError | Error | null;
}

/**
 * Data Context interface
 */
interface DataContextType {
  // Core data
  coreData: CoreData;
  loading: LoadingStates;
  errors: ErrorStates;
  
  // Utility functions
  isInitialized: boolean;
  refreshData: (dataType?: keyof CoreData) => Promise<void>;
  clearCache: () => void;
  
  // Cache statistics for debugging
  getCacheStats: () => any;
  
  // Dynamic report access (cached on-demand)
  getOnePagerReport: (subnetId: string) => Promise<any | null>;
  getDeepResearchReport: (subnetId: string) => Promise<any | null>;
  getCompetitiveAnalysisReport: (subnetId: string) => Promise<any | null>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * Hook to access global data context
 */
export const useDataContext = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};

/**
 * Hook to access only subnets data (most common use case)
 * This replaces direct StorageService calls in components
 */
export const useSubnetsData = () => {
  const { coreData, loading, errors } = useDataContext();
  return {
    data: coreData.subnetsData,
    loading: loading.subnetsData,
    error: errors.subnetsData,
  };
};

/**
 * Hook to access emissions data for EmissionsDataService
 */
export const useEmissionsData = () => {
  const { coreData, loading, errors } = useDataContext();
  return {
    data: coreData.emissionsData,
    loading: loading.emissionsData,
    error: errors.emissionsData,
  };
};

/**
 * Hook to access price data for PriceDataService
 */
export const usePricesData = () => {
  const { coreData, loading, errors } = useDataContext();
  return {
    data: coreData.pricesData,
    loading: loading.pricesData,
    error: errors.pricesData,
  };
};

/**
 * Hook to access percentiles data
 */
export const usePercentilesData = () => {
  const { coreData, loading, errors } = useDataContext();
  return {
    data: coreData.percentilesData,
    loading: loading.percentilesData,
    error: errors.percentilesData,
  };
};

interface DataProviderProps {
  children: ReactNode;
}

/**
 * Data Provider component that manages global cached data
 */
export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  // Core data states
  const [coreData, setCoreData] = useState<CoreData>({
    subnetsData: null,
    emissionsData: null,
    pricesData: null,
    percentilesData: null,
  });

  const [loading, setLoading] = useState<LoadingStates>({
    subnetsData: true,
    emissionsData: true,
    pricesData: true,
    percentilesData: true,
  });

  const [errors, setErrors] = useState<ErrorStates>({
    subnetsData: null,
    emissionsData: null,
    pricesData: null,
    percentilesData: null,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Setup cache subscriptions for reactive updates
   */
  useEffect(() => {
    console.log('🚀 DataContext: Setting up cache subscriptions...');

    // Subscription for subnets data (most critical)
    const unsubscribeSubnets = cacheService.subscribe<CategoryType[]>(
      CACHE_KEYS.SUBNETS_FRONTEND_READY,
      (data, error, isLoading) => {
        setCoreData(prev => ({ ...prev, subnetsData: data }));
        setLoading(prev => ({ ...prev, subnetsData: isLoading || false }));
        setErrors(prev => ({ ...prev, subnetsData: error }));
      }
    );

    // Subscription for emissions data
    const unsubscribeEmissions = cacheService.subscribe(
      CACHE_KEYS.SUBNET_EMISSIONS,
      (data, error, isLoading) => {
        setCoreData(prev => ({ ...prev, emissionsData: data }));
        setLoading(prev => ({ ...prev, emissionsData: isLoading || false }));
        setErrors(prev => ({ ...prev, emissionsData: error }));
      }
    );

    // Subscription for prices data
    const unsubscribePrices = cacheService.subscribe(
      CACHE_KEYS.SUBNET_PRICES,
      (data, error, isLoading) => {
        setCoreData(prev => ({ ...prev, pricesData: data }));
        setLoading(prev => ({ ...prev, pricesData: isLoading || false }));
        setErrors(prev => ({ ...prev, pricesData: error }));
      }
    );

    // Subscription for percentiles data
    const unsubscribePercentiles = cacheService.subscribe(
      CACHE_KEYS.SUBNET_PERCENTILES,
      (data, error, isLoading) => {
        setCoreData(prev => ({ ...prev, percentilesData: data }));
        setLoading(prev => ({ ...prev, percentilesData: isLoading || false }));
        setErrors(prev => ({ ...prev, percentilesData: error }));
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeSubnets();
      unsubscribeEmissions();
      unsubscribePrices();
      unsubscribePercentiles();
      console.log('🧹 DataContext: Cleaned up cache subscriptions');
    };
  }, []);

  /**
   * Initialize data on component mount
   */
  useEffect(() => {
    const initializeData = async () => {
      console.log('🎯 DataContext: Initializing core application data...');
      
      try {
        // Use Promise.allSettled to load all data in parallel
        // Even if some fail, others can still succeed
        await Promise.allSettled([
          // Critical data - load immediately
          cacheService.get(
            CACHE_KEYS.SUBNETS_FRONTEND_READY,
            (bypassCache) => storageService.fetchSubnetsFrontendReady<CategoryType[]>(bypassCache),
            CACHE_TTL.CORE_DATA
          ),
          
          // Supporting data - can load in background
          cacheService.get(
            CACHE_KEYS.SUBNET_EMISSIONS,
            (bypassCache) => storageService.fetchSubnetEmissions(bypassCache),
            CACHE_TTL.CORE_DATA
          ),
          
          cacheService.get(
            CACHE_KEYS.SUBNET_PRICES,
            (bypassCache) => storageService.fetchSubnetPrices(bypassCache),
            CACHE_TTL.CORE_DATA
          ),
          
          cacheService.get(
            CACHE_KEYS.SUBNET_PERCENTILES,
            (bypassCache) => storageService.fetchSubnetPercentiles(bypassCache),
            CACHE_TTL.CORE_DATA
          ),
        ]);

        setIsInitialized(true);
        console.log('✅ DataContext: Core data initialization completed');
        
      } catch (error) {
        console.error('❌ DataContext: Error during data initialization:', error);
        setIsInitialized(true); // Still mark as initialized even with errors
      }
    };

    initializeData();
  }, []);

  /**
   * Refresh specific data type or all data
   */
  const refreshData = async (dataType?: keyof CoreData): Promise<void> => {
    console.log(`🔄 DataContext: Refreshing ${dataType || 'all'} data...`);
    
    try {
      if (dataType === 'subnetsData' || !dataType) {
        cacheService.invalidate(CACHE_KEYS.SUBNETS_FRONTEND_READY);
        await cacheService.get(
          CACHE_KEYS.SUBNETS_FRONTEND_READY,
          (bypassCache) => storageService.fetchSubnetsFrontendReady<CategoryType[]>(bypassCache),
          CACHE_TTL.CORE_DATA
        );
      }
      
      if (dataType === 'emissionsData' || !dataType) {
        cacheService.invalidate(CACHE_KEYS.SUBNET_EMISSIONS);
        await cacheService.get(
          CACHE_KEYS.SUBNET_EMISSIONS,
          (bypassCache) => storageService.fetchSubnetEmissions(bypassCache),
          CACHE_TTL.CORE_DATA
        );
      }
      
      if (dataType === 'pricesData' || !dataType) {
        cacheService.invalidate(CACHE_KEYS.SUBNET_PRICES);
        await cacheService.get(
          CACHE_KEYS.SUBNET_PRICES,
          (bypassCache) => storageService.fetchSubnetPrices(bypassCache),
          CACHE_TTL.CORE_DATA
        );
      }
      
      if (dataType === 'percentilesData' || !dataType) {
        cacheService.invalidate(CACHE_KEYS.SUBNET_PERCENTILES);
        await cacheService.get(
          CACHE_KEYS.SUBNET_PERCENTILES,
          (bypassCache) => storageService.fetchSubnetPercentiles(bypassCache),
          CACHE_TTL.CORE_DATA
        );
      }
      
      console.log(`✅ DataContext: Successfully refreshed ${dataType || 'all'} data`);
      
    } catch (error) {
      console.error(`❌ DataContext: Error refreshing ${dataType || 'all'} data:`, error);
      throw error;
    }
  };

  /**
   * Clear entire cache (useful for logout/reset)
   */
  const clearCache = (): void => {
    cacheService.clearAll();
    setCoreData({
      subnetsData: null,
      emissionsData: null,
      pricesData: null,
      percentilesData: null,
    });
    setIsInitialized(false);
    console.log('🧹 DataContext: Cleared all cached data');
  };

  /**
   * Get cache statistics for debugging
   */
  const getCacheStats = () => {
    return cacheService.getStats();
  };

  /**
   * Dynamic report access with caching
   */
  const getOnePagerReport = async (subnetId: string): Promise<any | null> => {
    try {
      return await cacheService.get(
        CACHE_KEYS.ONE_PAGER(subnetId),
        () => storageService.fetchOnePagerReport(subnetId),
        CACHE_TTL.REPORTS
      );
    } catch (error) {
      if (error instanceof StorageError && error.status === 404) {
        // One-pager not available - this is expected for many subnets
        return null;
      }
      throw error;
    }
  };

  const getDeepResearchReport = async (subnetId: string): Promise<any | null> => {
    try {
      return await cacheService.get(
        CACHE_KEYS.DEEP_RESEARCH(subnetId),
        () => storageService.fetchDeepResearchReport(subnetId),
        CACHE_TTL.REPORTS
      );
    } catch (error) {
      if (error instanceof StorageError && error.status === 404) {
        // Deep research not available - this is expected for many subnets
        return null;
      }
      throw error;
    }
  };

  const getCompetitiveAnalysisReport = async (subnetId: string): Promise<any | null> => {
    try {
      return await cacheService.get(
        CACHE_KEYS.COMPETITIVE_ANALYSIS(subnetId),
        () => storageService.fetchCompetitiveAnalysisReport(subnetId),
        CACHE_TTL.REPORTS
      );
    } catch (error) {
      if (error instanceof StorageError && error.status === 404) {
        // Competitive analysis not available - this is expected for many subnets
        return null;
      }
      throw error;
    }
  };

  const contextValue: DataContextType = {
    coreData,
    loading,
    errors,
    isInitialized,
    refreshData,
    clearCache,
    getCacheStats,
    getOnePagerReport,
    getDeepResearchReport,
    getCompetitiveAnalysisReport,
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};

// ===== DYNAMIC REPORT HOOKS =====
// These hooks provide on-demand loading for individual subnet reports
// Following the same pattern as core data hooks but with per-subnet caching


/**
 * Hook to load and cache one-pager reports for multiple subnets (map-based)
 * More efficient for components that need multiple subnet reports
 * Universal access pattern - any component can request any combination of subnets
 */
export const useOnePagerReports = (subnetIds: string[]) => {
  const [data, setData] = useState<Map<string, unknown>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, StorageError | Error>>(new Map());

  useEffect(() => {
    if (!subnetIds.length) {
      setData(new Map());
      setLoading(new Set());
      setErrors(new Map());
      return;
    }

    let isMounted = true;
    const unsubscribers: (() => void)[] = [];

    // Filter out empty subnet IDs
    const validSubnetIds = subnetIds.filter(id => id && id.trim() !== '');

    // Set up cache subscriptions for all requested subnets
    validSubnetIds.forEach(subnetId => {
      const cacheKey = CACHE_KEYS.ONE_PAGER(subnetId);
      
      const unsubscribe = cacheService.subscribe(
        cacheKey,
        (reportData, cacheError, isLoading) => {
          if (!isMounted) return;

          // Update data map
          setData(prev => {
            const newData = new Map(prev);
            if (reportData !== null) {
              newData.set(subnetId, reportData);
            } else if (!isLoading && !cacheError) {
              // Clear data if not loading and no error (404 case)
              newData.delete(subnetId);
            }
            return newData;
          });

          // Update loading set
          setLoading(prev => {
            const newLoading = new Set(prev);
            if (isLoading) {
              newLoading.add(subnetId);
            } else {
              newLoading.delete(subnetId);
            }
            return newLoading;
          });

          // Update errors map
          setErrors(prev => {
            const newErrors = new Map(prev);
            if (cacheError) {
              newErrors.set(subnetId, cacheError);
            } else {
              newErrors.delete(subnetId);
            }
            return newErrors;
          });

        }
      );

      unsubscribers.push(unsubscribe);
    });

    // Trigger loading for all subnets
    const loadReports = async () => {
      await Promise.allSettled(
        validSubnetIds.map(async (subnetId) => {
          const cacheKey = CACHE_KEYS.ONE_PAGER(subnetId);
          
          try {
            await cacheService.get(
              cacheKey,
              (bypassCache) => storageService.fetchOnePagerReport(subnetId, false), // Always use browser cache for initial one-pager loads
              CACHE_TTL.REPORTS
            );
            // Data will be set via subscription callback
          } catch (err) {
            // Error handling is done via subscription callback
            console.log(`📄 useOnePagerReports: Error loading ${subnetId}:`, err);
          }
        })
      );
    };

    loadReports();

    // Cleanup function
    return () => {
      isMounted = false;
      unsubscribers.forEach(unsub => unsub());
    };
  }, [subnetIds.join(',')]); // Use string join for stable dependency instead of subnetIds array

  return { 
    data, 
    loading, 
    errors,
    // Helper functions for easier access
    getReport: (subnetId: string) => data.get(subnetId) || null,
    isLoading: (subnetId: string) => loading.has(subnetId),
    getError: (subnetId: string) => errors.get(subnetId) || null,
    hasAnyLoading: loading.size > 0,
    hasAnyErrors: errors.size > 0
  };
};

export default DataProvider;