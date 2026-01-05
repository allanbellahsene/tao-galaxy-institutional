// ===== PRICE DATA SERVICE =====
// Pure data processing service - optimized to use DataContext for data loading
// Eliminates duplicate API calls by using cached data from DataContext

interface PriceDataPoint {
  date: string;
  value: number;
}

interface SubnetPriceData {
  [subnetId: string]: PriceDataPoint[];
}

class PriceDataService {
  private static instance: PriceDataService;

  private constructor() {
    // Service initialized for data processing only
  }

  static getInstance(): PriceDataService {
    if (!PriceDataService.instance) {
      PriceDataService.instance = new PriceDataService();
    }
    return PriceDataService.instance;
  }

  /**
   * Process subnet price data for chart visualization
   * @param priceData - Raw price data from DataContext
   * @param subnetId - Subnet ID string
   * @param timeframe - Time period (7D, 30D, 90D, 1Y, ALL)
   * @param customStartDate - Optional custom start date
   * @param customEndDate - Optional custom end date
   */

  getSubnetPriceData(
    priceData: SubnetPriceData | null,
    subnetId: string,
    timeframe: string = '7D',
    customStartDate?: string,
    customEndDate?: string
  ): PriceDataPoint[] {
    if (!priceData) {
      console.warn(`No price data provided`);
      return [];
    }

    const allData = priceData[subnetId] || [];

    if (allData.length === 0) {
      return [];
    }

    const filtered = this.filterDataByTimeframe(allData, timeframe, customStartDate, customEndDate);
    return filtered;
  }

  getTaoPriceData(
    priceData: SubnetPriceData | null,
    timeframe: string = '7D',
    customStartDate?: string,
    customEndDate?: string
  ): PriceDataPoint[] {
    if (!priceData) {
      console.warn('No price data provided');
      return [];
    }

    const allData = priceData['TAO'] || [];

    if (allData.length === 0) {
      console.warn('No TAO price data found, returning empty array');
      return [];
    }

    return this.filterDataByTimeframe(allData, timeframe, customStartDate, customEndDate);
  }

  getSubnetPriceDataInUSD(
    priceData: SubnetPriceData | null,
    subnetId: string,
    timeframe: string = '7D',
    customStartDate?: string,
    customEndDate?: string
  ): PriceDataPoint[] {
    if (!priceData) {
      console.warn('No price data provided');
      return [];
    }

    // Get subnet price data (in TAO)
    const subnetData = priceData[subnetId] || [];
    if (subnetData.length === 0) {
      return [];
    }

    // Get TAO price data (in USD)
    const taoData = priceData['TAO'] || [];
    if (taoData.length === 0) {
      console.warn('No TAO price data found for USD conversion, returning empty array');
      return [];
    }

    // Create a map of TAO prices by date for quick lookup
    const taoPriceMap = new Map<string, number>();
    taoData.forEach((point: PriceDataPoint) => {
      taoPriceMap.set(point.date, point.value);
    });

    // Convert subnet prices from TAO to USD
    const usdData: PriceDataPoint[] = [];
    subnetData.forEach((subnetPoint: PriceDataPoint) => {
      const taoPrice = taoPriceMap.get(subnetPoint.date);
      if (taoPrice !== undefined) {
        // Subnet price in USD = Subnet price in TAO × TAO price in USD
        usdData.push({
          date: subnetPoint.date,
          value: subnetPoint.value * taoPrice
        });
      }
    });

    // Filter by timeframe or custom date range
    return this.filterDataByTimeframe(usdData, timeframe, customStartDate, customEndDate);
  }

  private filterDataByTimeframe(data: PriceDataPoint[], timeframe: string, customStartDate?: string, customEndDate?: string): PriceDataPoint[] {
    // If custom date range is provided, use it
    if (customStartDate && customEndDate) {
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);

      return data.filter((point: PriceDataPoint) => {
        const pointDate = new Date(point.date);
        return pointDate >= startDate && pointDate <= endDate;
      });
    }

    // Otherwise use predefined timeframes
    if (timeframe === 'ALL') return data;

    const now = new Date();
    let daysBack = 7;

    switch (timeframe) {
      case '30D':
        daysBack = 30;
        break;
      case '90D':
        daysBack = 90;
        break;
      case '1Y':
        daysBack = 365;
        break;
      case '7D':
      default:
        daysBack = 7;
        break;
    }

    const cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    const filtered = data.filter((point: PriceDataPoint) => new Date(point.date) >= cutoffDate);

    // If no data exists within the desired window, return the most recent data points
    if (filtered.length === 0) {
      return data.slice(-daysBack);
    }

    return filtered;
  }

  getAvailableSubnets(priceData: SubnetPriceData | null): string[] {
    if (!priceData) return [];
    return Object.keys(priceData);
  }

  getCurrentPrice(priceData: SubnetPriceData | null, subnetId: string): number | null {
    if (!priceData) return null;
    const data = priceData[subnetId];
    if (!data || data.length === 0) return null;
    return data[data.length - 1].value;
  }

  getPriceChange(priceData: SubnetPriceData | null, subnetId: string, days: number = 1): number | null {
    if (!priceData) return null;
    const data = priceData[subnetId];
    if (!data || data.length < 2) return null;

    const latest = data[data.length - 1];
    const comparison = data[Math.max(0, data.length - 1 - days)];

    if (!latest || !comparison) return null;

    return ((latest.value - comparison.value) / comparison.value) * 100;
  }
}

export default PriceDataService;
