import React, { useMemo, useState } from 'react';
import {
  Plus,
  Check
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  Line,
  LineChart,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useSubnetsData } from '../../context/DataContext';
import { SubnetType } from '../../types';
import { format, subDays } from 'date-fns';

// ==================== TYPES ====================

interface MinerFlowDataPoint {
  date: string;
  tao: number;
  usd: number;
  priceSum?: number;
}

interface SubnetMinerFlowData {
  subnetId: string;
  subnetName: string;
  subnetNumber: number;
  marketCap: number;
  alphaSold: MinerFlowDataPoint[];
  sellThroughRate: Array<{ date: string; rate: number }>;
  holdingPeriods: {
    '<1d': number;
    '1-3d': number;
    '3-7d': number;
    '7-14d': number;
    '>14d': number;
  };
  avgHoldingDays: number;
}

type Timeframe = '30d' | '90d' | 'all';
type Currency = 'TAO' | 'USD';
type HoldingPeriodMode = 'worst' | 'best' | 'custom';
type HoldingPeriodTimeframe = '1d' | '7d' | '30d' | '90d' | 'all';
type TopMoversPeriod = '7d' | '30d' | '90d' | 'all';
type PeriodKey = TopMoversPeriod | HoldingPeriodTimeframe;
type CorrelationPeriod = TopMoversPeriod;

// ==================== UTILITY FUNCTIONS ====================

const seededRandom = (seed: string, index: number): number => {
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), index * 137);
  return (Math.sin(hash) + 1) / 2;
};

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const getPeriodDays = (period: PeriodKey): number => {
  switch (period) {
    case '1d':
      return 1;
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case 'all':
    default:
      return 365;
  }
};

const getHoldingVariance = (period: PeriodKey): number => {
  switch (period) {
    case '1d':
      return 14;
    case '7d':
      return 12;
    case '30d':
      return 9;
    case '90d':
      return 7;
    case 'all':
    default:
      return 6;
  }
};

const getSubnetNumber = (subnetId: string): number => {
  const match = subnetId.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

const getSubnetTier = (marketCap: number): 'S' | 'A' | 'B' | 'C' => {
  if (marketCap > 50000000) return 'S';
  if (marketCap > 10000000) return 'A';
  if (marketCap > 1000000) return 'B';
  return 'C';
};

const formatCurrency = (value: number, prefix = '$'): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (value >= 1000000) {
    return `${prefix}${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${prefix}${(value / 1000).toFixed(2)}K`;
  }
  return `${prefix}${value.toLocaleString('en-US', {
    maximumFractionDigits: value >= 1000 ? 0 : 2
  })}`;
};

const formatTAO = (value: number): string => {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} τ`;
};

const formatCompactNumber = (value: number): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
};

const formatCompactCurrency = (value: number, prefix = '$'): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${prefix}${formatCompactNumber(value)}`;
};

const truncateLabel = (value: string, maxLength = 12): string => {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};

// ==================== MOCK DATA GENERATION ====================

const generateAlphaSoldTimeSeries = (
  subnetId: string,
  days: number,
  baseVolume: number
): MinerFlowDataPoint[] => {
  const data: MinerFlowDataPoint[] = [];
  const taoPrice = 350; // mock TAO price

  for (let i = 0; i < days; i++) {
    const volatility = 0.22 + seededRandom(subnetId, i) * 0.12; // 22-34%
    const trend = Math.sin(i / 6) * 0.12; // weekly cycles
    const midTrend = Math.sin(i / 18) * 0.06;
    const drift = (i / Math.max(1, days - 1) - 0.5) * 0.08;
    const randomFactor = (seededRandom(subnetId, i * 2) - 0.5) * volatility;
    const tao = baseVolume * (1 + trend + midTrend + drift) * (1 + randomFactor);

    data.push({
      date: format(subDays(new Date(), days - i), 'MMM dd'),
      tao: Math.max(0, Math.round(tao)),
      usd: Math.max(0, Math.round(tao * taoPrice))
    });
  }

  return data;
};

const generatePriceSumHistory = (days: number): number[] => {
  const values: number[] = [];
  const spikeDays = Math.min(5, Math.max(3, Math.floor(days * 0.02)));
  const phaseOneEnd = Math.floor(days * 0.35);
  const phaseTwoEnd = Math.floor(days * 0.7);

  for (let i = 0; i < days; i++) {
    let value: number;
    if (i < spikeDays) {
      value = 2.3 + seededRandom('price-sum', i) * 0.25;
    } else if (i < phaseOneEnd) {
      const t = (i - spikeDays) / Math.max(1, phaseOneEnd - spikeDays);
      value = 1.55 - t * 0.4;
    } else if (i < phaseTwoEnd) {
      const t = (i - phaseOneEnd) / Math.max(1, phaseTwoEnd - phaseOneEnd);
      value = 1.15 - t * 0.14;
    } else {
      const t = (i - phaseTwoEnd) / Math.max(1, days - phaseTwoEnd - 1);
      value = 1.01 + t * 0.09;
    }

    const noise = (seededRandom('price-sum', i + 11) - 0.5) * 0.02;
    values.push(Number((value + noise).toFixed(3)));
  }

  return values;
};

const generateBetaSeries = (seedKey: string, days: number): Array<{ date: string; value: number }> => {
  const data: Array<{ date: string; value: number }> = [];
  const base = 0.7 + seededRandom(seedKey, 1) * 0.4;

  for (let i = 0; i < days; i++) {
    const progress = i / Math.max(1, days - 1);
    const cycle = Math.sin(i / 9) * 0.05 + Math.sin(i / 22) * 0.04;
    const drift = progress < 0.65
      ? 0.05 - progress * 0.12
      : -0.03 + (progress - 0.65) * 0.08;
    const noise = (seededRandom(`${seedKey}-beta`, i * 3) - 0.5) * 0.06;
    let value = base + cycle + drift + noise;

    if (i < 3 && days > 200) {
      value += 0.35 - i * 0.12;
    }

    value = clampNumber(value, 0.25, 1.85);
    data.push({
      date: format(subDays(new Date(), days - i), 'MMM dd'),
      value: Number(value.toFixed(3))
    });
  }

  return data;
};

const generatePriceReturnSeries = (seedKey: string, days: number): number[] => {
  const returns: number[] = [];
  const baseVol = 0.012 + seededRandom(seedKey, 2) * 0.01;

  for (let i = 0; i < days; i++) {
    const cycle = Math.sin(i / 9) * 0.006 + Math.sin(i / 21) * 0.004;
    const drift = (i / Math.max(1, days - 1) - 0.45) * -0.002;
    const noise = (seededRandom(`${seedKey}-ret`, i * 4) - 0.5) * baseVol * 2.2;
    const value = cycle + drift + noise;
    returns.push(value);
  }

  return returns;
};

const generateSellThroughRate = (
  subnetId: string,
  tier: string,
  days: number
): Array<{ date: string; rate: number }> => {
  const baseRate = tier === 'S' ? 30 : tier === 'A' ? 50 : tier === 'B' ? 65 : 80;
  const data: Array<{ date: string; rate: number }> = [];

  for (let i = 0; i < days; i++) {
    const trend = Math.sin(i / 14) * 7; // bi-weekly cycles
    const noise = (seededRandom(subnetId, i * 3) - 0.5) * 15;
    const rate = baseRate + trend + noise;

    data.push({
      date: format(subDays(new Date(), days - i), 'MMM dd'),
      rate: Math.max(5, Math.min(95, rate))
    });
  }

  return data;
};

const generateHoldingPeriods = (
  subnetId: string,
  tier: string
): {
  '<1d': number;
  '1-3d': number;
  '3-7d': number;
  '7-14d': number;
  '>14d': number;
} => {
  // S-tier: more long-term holding
  // Lower-tier: more short-term extraction
  if (tier === 'S') {
    return {
      '<1d': 5 + seededRandom(subnetId, 1) * 10,
      '1-3d': 8 + seededRandom(subnetId, 2) * 10,
      '3-7d': 12 + seededRandom(subnetId, 3) * 10,
      '7-14d': 22 + seededRandom(subnetId, 4) * 15,
      '>14d': 45 + seededRandom(subnetId, 5) * 18
    };
  } else if (tier === 'A') {
    return {
      '<1d': 10 + seededRandom(subnetId, 1) * 15,
      '1-3d': 15 + seededRandom(subnetId, 2) * 15,
      '3-7d': 20 + seededRandom(subnetId, 3) * 15,
      '7-14d': 25 + seededRandom(subnetId, 4) * 15,
      '>14d': 20 + seededRandom(subnetId, 5) * 12
    };
  } else if (tier === 'B') {
    return {
      '<1d': 20 + seededRandom(subnetId, 1) * 20,
      '1-3d': 25 + seededRandom(subnetId, 2) * 15,
      '3-7d': 20 + seededRandom(subnetId, 3) * 15,
      '7-14d': 18 + seededRandom(subnetId, 4) * 12,
      '>14d': 7 + seededRandom(subnetId, 5) * 10
    };
  } else {
    return {
      '<1d': 35 + seededRandom(subnetId, 1) * 20,
      '1-3d': 30 + seededRandom(subnetId, 2) * 15,
      '3-7d': 20 + seededRandom(subnetId, 3) * 10,
      '7-14d': 10 + seededRandom(subnetId, 4) * 6,
      '>14d': 4 + seededRandom(subnetId, 5) * 4
    };
  }
};

const normalizeHoldingPeriods = (periods: {
  '<1d': number;
  '1-3d': number;
  '3-7d': number;
  '7-14d': number;
  '>14d': number;
}): typeof periods => {
  const total = periods['<1d'] + periods['1-3d'] + periods['3-7d'] + periods['7-14d'] + periods['>14d'];
  return {
    '<1d': (periods['<1d'] / total) * 100,
    '1-3d': (periods['1-3d'] / total) * 100,
    '3-7d': (periods['3-7d'] / total) * 100,
    '7-14d': (periods['7-14d'] / total) * 100,
    '>14d': (periods['>14d'] / total) * 100
  };
};

const adjustHoldingPeriods = (
  periods: {
    '<1d': number;
    '1-3d': number;
    '3-7d': number;
    '7-14d': number;
    '>14d': number;
  },
  seedKey: string,
  variance: number
): typeof periods => {
  const adjusted = {
    '<1d': Math.max(0.5, periods['<1d'] + (seededRandom(`${seedKey}-0`, 1) - 0.5) * variance),
    '1-3d': Math.max(0.5, periods['1-3d'] + (seededRandom(`${seedKey}-1`, 2) - 0.5) * variance),
    '3-7d': Math.max(0.5, periods['3-7d'] + (seededRandom(`${seedKey}-2`, 3) - 0.5) * variance),
    '7-14d': Math.max(0.5, periods['7-14d'] + (seededRandom(`${seedKey}-3`, 4) - 0.5) * variance),
    '>14d': Math.max(0.5, periods['>14d'] + (seededRandom(`${seedKey}-4`, 5) - 0.5) * variance)
  };

  return normalizeHoldingPeriods(adjusted);
};

const calculateAvgHoldingDays = (periods: {
  '<1d': number;
  '1-3d': number;
  '3-7d': number;
  '7-14d': number;
  '>14d': number;
}): number => {
  // Weighted average
  const weights = {
    '<1d': 0.5,
    '1-3d': 2,
    '3-7d': 5,
    '7-14d': 10,
    '>14d': 20
  };

  const total = periods['<1d'] + periods['1-3d'] + periods['3-7d'] + periods['7-14d'] + periods['>14d'];
  if (total === 0) return 0;

  return (
    (periods['<1d'] * weights['<1d'] +
    periods['1-3d'] * weights['1-3d'] +
    periods['3-7d'] * weights['3-7d'] +
    periods['7-14d'] * weights['7-14d'] +
    periods['>14d'] * weights['>14d']) / total
  );
};

const getHoldingStatsWithVariance = (
  subnet: SubnetMinerFlowData,
  periodKey: PeriodKey
): { adjustedHolding: SubnetMinerFlowData['holdingPeriods']; avgHoldingDays: number } => {
  const variance = getHoldingVariance(periodKey);
  const adjustedHolding = adjustHoldingPeriods(
    subnet.holdingPeriods,
    `${subnet.subnetId}-${periodKey}`,
    variance
  );
  return {
    adjustedHolding,
    avgHoldingDays: calculateAvgHoldingDays(adjustedHolding)
  };
};

const generateAllMinerFlowsData = (
  subnets: SubnetType[],
  timeframe: Timeframe
): SubnetMinerFlowData[] => {
  const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;

  return subnets.map(subnet => {
    const subnetNumber = getSubnetNumber(subnet.id);
    const marketCap = subnet.marketCap || 0;
    const tier = getSubnetTier(marketCap);

    // Base volume scales with market cap and emissions
    const baseVolume = Math.max(10, (marketCap / 1000000) * 5 + (subnet.emissions || 0) * 100);

    const alphaSold = generateAlphaSoldTimeSeries(subnet.id, days, baseVolume);
    const sellThroughRate = generateSellThroughRate(subnet.id, tier, days);
    const rawHoldingPeriods = generateHoldingPeriods(subnet.id, tier);
    const holdingPeriods = normalizeHoldingPeriods(rawHoldingPeriods);
    const avgHoldingDays = calculateAvgHoldingDays(rawHoldingPeriods);

    return {
      subnetId: subnet.id,
      subnetName: subnet.name,
      subnetNumber,
      marketCap,
      alphaSold,
      sellThroughRate,
      holdingPeriods,
      avgHoldingDays
    };
  });
};

// ==================== COLOR PALETTE ====================

const CHART_COLORS = {
  teal: '#0f766e',
  emerald: '#15803d',
  rose: '#be123c',
  red: '#b91c1c',
  indigo: '#1e3a8a',
  purple: '#4c1d95',
  cyan: '#0e7490',
  lime: '#4d7c0f',
  orange: '#c2410c',
  pink: '#9d174d',
  sky: '#0369a1',
  amber: '#a16207',
  slate: '#334155',
  steel: '#64748b'
};

const PALETTE_10 = [
  CHART_COLORS.teal,
  CHART_COLORS.cyan,
  CHART_COLORS.indigo,
  CHART_COLORS.slate,
  CHART_COLORS.steel,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.rose,
  CHART_COLORS.orange,
  CHART_COLORS.purple
];

const HOLDING_COLORS = {
  short: CHART_COLORS.rose,
  shortMid: CHART_COLORS.orange,
  mid: CHART_COLORS.amber,
  midLong: CHART_COLORS.teal,
  long: CHART_COLORS.emerald
};

// ==================== SUB-COMPONENTS ====================

interface SegmentedToggleOption {
  value: string;
  label: string;
}

interface SegmentedToggleProps {
  value: string;
  options: SegmentedToggleOption[];
  onChange: (value: string) => void;
  isLightMode: boolean;
  label?: string;
  size?: 'sm' | 'md';
}

const SegmentedToggle: React.FC<SegmentedToggleProps> = ({
  value,
  options,
  onChange,
  isLightMode,
  label,
  size = 'md'
}) => {
  const buttonSize = size === 'sm' ? 'px-3 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs';

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className={`text-[10px] uppercase tracking-[0.2em] font-semibold ml-1 ${
          isLightMode ? 'text-slate-600' : 'text-slate-400'
        }`}>
          {label}
        </div>
      )}
      <div className={`flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border ${
        isLightMode
          ? 'bg-white border-slate-200'
          : 'bg-slate-950/50 border-white/10'
      }`}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-lg border transition-all duration-200 ${buttonSize} ${
                isActive
                  ? isLightMode
                    ? 'bg-slate-900/5 text-slate-900 border-slate-200 shadow-sm font-semibold'
                    : 'bg-white/10 text-white border-white/10 shadow-sm font-semibold'
                  : isLightMode
                    ? 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100 font-medium'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5 font-medium'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

    </div>
  );
};

interface SubnetLogoButtonProps {
  subnet: { id: string; name: string };
  subnetNumber: number;
  selected: boolean;
  onClick: () => void;
  isLightMode: boolean;
}

const SubnetLogoButton: React.FC<SubnetLogoButtonProps> = ({
  subnet,
  subnetNumber,
  selected,
  onClick,
  isLightMode
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        group relative rounded-2xl p-3 transition-all duration-200 border shadow-sm
        ${selected
          ? isLightMode
            ? 'bg-slate-900/5 border-slate-300 ring-1 ring-slate-300/60'
            : 'bg-white/5 border-white/10 ring-1 ring-white/10'
          : isLightMode
            ? 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
            : 'bg-slate-900/40 hover:bg-slate-800/50 border-white/5 hover:border-white/10'}
      `}
      title={`${subnet.name} (${subnet.id})`}
    >
      <img
        src={`/logos/${subnetNumber}.webp`}
        alt={subnet.name}
        className={`w-12 h-12 object-contain transition-all duration-300 ${selected ? 'opacity-100 scale-105' : 'opacity-70 group-hover:opacity-100 group-hover:scale-105'}`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const parent = e.currentTarget.parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = `text-xs font-bold font-mono ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`;
            fallback.textContent = `SN${subnetNumber}`;
            parent.appendChild(fallback);
          }
        }}
      />
      {selected && (
        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border ${
          isLightMode ? 'bg-slate-900 border-white' : 'bg-teal-500 border-slate-900'
        }`}>
          <Check size={12} className="text-white" />
        </div>
      )}
    </button>
  );
};

// ==================== MAIN COMPONENT ====================

interface MinerFlowsViewProps {
  isLightMode: boolean;
}

export const MinerFlowsView: React.FC<MinerFlowsViewProps> = ({ isLightMode }) => {
  const { data: subnetsData } = useSubnetsData();

  // State
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [currency, setCurrency] = useState<Currency>('TAO');
  const [holdingPeriodMode, setHoldingPeriodMode] = useState<HoldingPeriodMode>('worst');
  const [holdingPeriodTimeframe, setHoldingPeriodTimeframe] = useState<HoldingPeriodTimeframe>('30d');
  const [customSubnets, setCustomSubnets] = useState<string[]>([]);
  const [showHoldingSelector, setShowHoldingSelector] = useState(false);
  const [sellThroughPeriod, setSellThroughPeriod] = useState<TopMoversPeriod>('30d');
  const [topMoversPeriod, setTopMoversPeriod] = useState<TopMoversPeriod>('30d');
  const [correlationPeriod, setCorrelationPeriod] = useState<CorrelationPeriod>('30d');
  const [betaSubnets, setBetaSubnets] = useState<string[]>([]);
  const [showBetaSelector, setShowBetaSelector] = useState(false);

  const axisColor = isLightMode ? '#475569' : '#94a3b8';
  const gridColor = isLightMode ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.12)';
  const tooltipStyle = {
    backgroundColor: isLightMode ? 'rgba(255,255,255,0.97)' : 'rgba(2,6,23,0.95)',
    border: `1px solid ${isLightMode ? '#e2e8f0' : 'rgba(148,163,184,0.2)'}`,
    borderRadius: '14px',
    padding: '12px 14px',
    backdropFilter: 'blur(16px)',
    boxShadow: isLightMode ? '0 12px 30px rgba(15,23,42,0.08)' : '0 12px 30px rgba(2,6,23,0.6)'
  };
  const tooltipLabelStyle = {
    color: isLightMode ? '#0f172a' : '#e2e8f0',
    fontWeight: 600,
    fontSize: '12px',
    marginBottom: '6px'
  };
  const tooltipItemStyle = {
    color: isLightMode ? '#0f172a' : '#e2e8f0',
    fontWeight: 600
  };
  const axisTick = { fill: axisColor, fontSize: 11, fontWeight: 500 };

  // Flatten subnets
  const flattenSubnets = useMemo(() => {
    if (!subnetsData) return [];
    return subnetsData.flatMap(cat => cat.subnets);
  }, [subnetsData]);

  const subnetNameLookup = useMemo(() => {
    return new Map(flattenSubnets.map(subnet => [subnet.id, subnet.name]));
  }, [flattenSubnets]);

  // Generate mock data
  const minerFlowsData = useMemo(
    () => generateAllMinerFlowsData(flattenSubnets, timeframe),
    [flattenSubnets, timeframe]
  );

  // Chart 1: Total Alpha Sold (aggregate)
  const totalAlphaSoldData = useMemo(() => {
    if (!minerFlowsData.length) return [];

    const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
    const aggregated: MinerFlowDataPoint[] = [];
    const priceHistory = generatePriceSumHistory(365);
    const priceSlice = priceHistory.slice(-days);

    for (let i = 0; i < days; i++) {
      const date = minerFlowsData[0]?.alphaSold[i]?.date || '';
      let totalTao = 0;
      let totalUsd = 0;

      minerFlowsData.forEach(subnet => {
        if (subnet.alphaSold[i]) {
          totalTao += subnet.alphaSold[i].tao;
          totalUsd += subnet.alphaSold[i].usd;
        }
      });

      const aggregateNoise = (seededRandom('alpha-agg', i) - 0.5) * 0.06;
      const adjustedTao = Math.max(0, totalTao * (1 + aggregateNoise));
      const adjustedUsd = Math.max(0, totalUsd * (1 + aggregateNoise));

      aggregated.push({
        date,
        tao: adjustedTao,
        usd: adjustedUsd,
        priceSum: priceSlice[i] ?? 1
      });
    }

    return aggregated;
  }, [minerFlowsData, timeframe]);

  // Chart 2: Alpha Sales by Subnet (stacked + pie)
  const alphaBySubnetData = useMemo(() => {
    const sorted = [...minerFlowsData].sort((a, b) => {
      const aTotal = a.alphaSold.reduce((sum, d) => sum + d.tao, 0);
      const bTotal = b.alphaSold.reduce((sum, d) => sum + d.tao, 0);
      return bTotal - aTotal;
    });

    const top10 = sorted.slice(0, 10);
    const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;

    // Stacked area data
    const stackedData: any[] = [];
    for (let i = 0; i < days; i++) {
      const dataPoint: any = { date: totalAlphaSoldData[i]?.date || '' };
      top10.forEach(subnet => {
        dataPoint[subnet.subnetId] = subnet.alphaSold[i]?.[currency === 'TAO' ? 'tao' : 'usd'] || 0;
      });
      stackedData.push(dataPoint);
    }

    // Pie data
    const pieData = top10.map(subnet => ({
      name: subnet.subnetName,
      value: subnet.alphaSold.reduce((sum, d) => sum + (currency === 'TAO' ? d.tao : d.usd), 0)
    }));

    return { stackedData, pieData, top10 };
  }, [minerFlowsData, totalAlphaSoldData, timeframe, currency]);

  // Chart 3: Sell-Through Rates (Snapshot comparison)
  const sellThroughData = useMemo(() => {
    const periodDays = getPeriodDays(sellThroughPeriod);
    const sorted = minerFlowsData.map(subnet => {
      const sliceLength = Math.min(periodDays, subnet.sellThroughRate.length);
      const series = sliceLength
        ? subnet.sellThroughRate.slice(-sliceLength)
        : subnet.sellThroughRate;
      const baseAvg = series.reduce((sum, d) => sum + d.rate, 0) / (series.length || 1);
      const bias = (seededRandom(`${subnet.subnetId}-${sellThroughPeriod}`, 9) - 0.5) * 18;
      const avgRate = clampNumber(baseAvg + bias, 5, 95);
      return {
        ...subnet,
        avgSellThroughRate: avgRate
      };
    }).sort((a, b) => b.avgSellThroughRate - a.avgSellThroughRate);

    const highest5 = sorted.slice(0, 5);
    const lowest5 = sorted.slice(-5).reverse();

    return { highest5, lowest5 };
  }, [minerFlowsData, sellThroughPeriod]);

  // Chart 5: Holding Period Distribution
  const holdingPeriodData = useMemo(() => {
    const enriched = minerFlowsData.map(subnet => {
      const { adjustedHolding, avgHoldingDays } = getHoldingStatsWithVariance(
        subnet,
        holdingPeriodTimeframe
      );
      return {
        subnet,
        adjustedHolding,
        avgHoldingDays
      };
    });

    let selectedSubnets = enriched;

    if (holdingPeriodMode === 'worst') {
      selectedSubnets = [...enriched]
        .sort((a, b) => a.avgHoldingDays - b.avgHoldingDays)
        .slice(0, 10);
    } else if (holdingPeriodMode === 'best') {
      selectedSubnets = [...enriched]
        .sort((a, b) => b.avgHoldingDays - a.avgHoldingDays)
        .slice(0, 10);
    } else {
      selectedSubnets = enriched
        .filter(s => customSubnets.includes(s.subnet.subnetId))
        .slice(0, 10);
    }

    return selectedSubnets.map(({ subnet, adjustedHolding }) => ({
      subnetId: subnet.subnetId,
      subnetName: subnet.subnetName,
      '<1d': adjustedHolding['<1d'],
      '1-3d': adjustedHolding['1-3d'],
      '3-7d': adjustedHolding['3-7d'],
      '7-14d': adjustedHolding['7-14d'],
      '>14d': adjustedHolding['>14d']
    }));
  }, [minerFlowsData, holdingPeriodMode, customSubnets, holdingPeriodTimeframe]);

  // Chart 6: Top Movers
  const topMoversData = useMemo(() => {
    const enriched = minerFlowsData.map(subnet => {
      const { avgHoldingDays } = getHoldingStatsWithVariance(subnet, topMoversPeriod);
      return {
        ...subnet,
        avgHoldingDays
      };
    });
    const sorted = [...enriched].sort((a, b) => a.avgHoldingDays - b.avgHoldingDays);

    return {
      fastest: sorted.slice(0, 5),
      slowest: sorted.slice(-5).reverse()
    };
  }, [minerFlowsData, topMoversPeriod]);

  const dumpPumpResponseData = useMemo(() => {
    const periodDays = getPeriodDays(correlationPeriod);
    const metrics = minerFlowsData.map(subnet => {
      const returns = generatePriceReturnSeries(subnet.subnetId, periodDays);
      const sliceLength = Math.min(periodDays, subnet.sellThroughRate.length);
      const sellSeries = sliceLength
        ? subnet.sellThroughRate.slice(-sliceLength).map(d => d.rate)
        : subnet.sellThroughRate.map(d => d.rate);

      const mean = returns.reduce((sum, v) => sum + v, 0) / (returns.length || 1);
      const variance = returns.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (returns.length || 1);
      const sigma = Math.sqrt(variance) || 0.01;

      const dumpIndices = returns.map((v, idx) => (v < mean - sigma ? idx : -1)).filter(idx => idx >= 0);
      const notDumpIndices = returns.map((v, idx) => (v >= mean - sigma ? idx : -1)).filter(idx => idx >= 0);
      const pumpIndices = returns.map((v, idx) => (v > mean + sigma ? idx : -1)).filter(idx => idx >= 0);
      const notPumpIndices = returns.map((v, idx) => (v <= mean + sigma ? idx : -1)).filter(idx => idx >= 0);

      const averageByIndices = (indices: number[]) => {
        if (!indices.length) return sellSeries.reduce((sum, v) => sum + v, 0) / (sellSeries.length || 1);
        return indices.reduce((sum, idx) => sum + (sellSeries[idx] ?? 0), 0) / indices.length;
      };

      const avgDump = averageByIndices(dumpIndices);
      const avgNotDump = averageByIndices(notDumpIndices);
      const avgPump = averageByIndices(pumpIndices);
      const avgNotPump = averageByIndices(notPumpIndices);

      return {
        subnetId: subnet.subnetId,
        subnetName: subnet.subnetName,
        dumpResponse: Number((avgDump - avgNotDump).toFixed(2)),
        pumpResponse: Number((avgPump - avgNotPump).toFixed(2))
      };
    });

    const dumpSorted = [...metrics].sort((a, b) => b.dumpResponse - a.dumpResponse);
    const pumpSorted = [...metrics].sort((a, b) => b.pumpResponse - a.pumpResponse);

    return {
      dumpBest: dumpSorted.slice(0, 5),
      dumpWorst: dumpSorted.slice(-5).reverse(),
      pumpBest: pumpSorted.slice(0, 5),
      pumpWorst: pumpSorted.slice(-5).reverse()
    };
  }, [minerFlowsData, correlationPeriod]);

  const betaSeriesData = useMemo(() => {
    if (!totalAlphaSoldData.length) return [];
    const days = totalAlphaSoldData.length;
    const networkSeries = generateBetaSeries('network-beta', days);
    const selectedSeries = betaSubnets.map(subnetId => ({
      subnetId,
      series: generateBetaSeries(subnetId, days)
    }));

    return totalAlphaSoldData.map((point, index) => {
      const row: Record<string, string | number> = {
        date: point.date,
        networkBeta: networkSeries[index]?.value ?? 0
      };
      selectedSeries.forEach(({ subnetId, series }) => {
        row[subnetId] = series[index]?.value ?? 0;
      });
      return row;
    });
  }, [betaSubnets, totalAlphaSoldData]);

  const betaRankings = useMemo(() => {
    if (!minerFlowsData.length) return { highest: [], lowest: [] };
    const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
    const ranked = minerFlowsData.map(subnet => {
      const series = generateBetaSeries(subnet.subnetId, days);
      const avg = series.reduce((sum, point) => sum + point.value, 0) / (series.length || 1);
      return {
        ...subnet,
        avgBeta: Number(avg.toFixed(3))
      };
    }).sort((a, b) => b.avgBeta - a.avgBeta);

    return {
      highest: ranked.slice(0, 5),
      lowest: ranked.slice(-5).reverse()
    };
  }, [minerFlowsData, timeframe]);

  const priceSumDomain = useMemo(() => {
    if (!totalAlphaSoldData.length) return [0.8, 2.6];
    const values = totalAlphaSoldData.map(point => point.priceSum ?? 1);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return [Number((min - 0.05).toFixed(2)), Number((max + 0.05).toFixed(2))];
    }
    const padding = Math.max(0.02, (max - min) * 0.12);
    const lower = Math.max(0, min - padding);
    const upper = max + padding;
    return [Number(lower.toFixed(2)), Number(upper.toFixed(2))];
  }, [totalAlphaSoldData]);

  // Toggle subnet selection
  const toggleSubnetSelection = (subnetId: string) => {
    setCustomSubnets(prev => {
      if (prev.includes(subnetId)) {
        return prev.filter(id => id !== subnetId);
      } else if (prev.length < 10) {
        return [...prev, subnetId];
      }
      return prev;
    });
  };

  const toggleBetaSubnet = (subnetId: string) => {
    setBetaSubnets(prev => {
      if (prev.includes(subnetId)) {
        return prev.filter(id => id !== subnetId);
      }
      if (prev.length < 5) {
        return [...prev, subnetId];
      }
      return prev;
    });
  };

  return (
    <div className="space-y-8">
      {/* Chart 1: Total Alpha Sold */}
      <div
        className={`rounded-3xl border backdrop-blur-xl p-8 shadow-xl ${
          isLightMode
            ? 'border-slate-200 bg-white/90 shadow-slate-200/40'
            : 'border-white/5 bg-slate-900/40 shadow-black/30'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className={`text-2xl font-semibold mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
              Total Miner Sales vs. Sum of Subnets
            </h2>
            <p className={`text-base leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Alpha rewards swapped by miners across all subnets versus sum of subnet prices
            </p>
            <div className={`text-xs mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <SegmentedToggle
              value={timeframe}
              options={[
                { value: '30d', label: '30D' },
                { value: '90d', label: '90D' },
                { value: 'all', label: 'All' }
              ]}
              onChange={(val) => setTimeframe(val as Timeframe)}
              isLightMode={isLightMode}
              label="Timeframe"
              size="sm"
            />
            <SegmentedToggle
              value={currency}
              options={[
                { value: 'TAO', label: 'TAO' },
                { value: 'USD', label: 'USD' }
              ]}
              onChange={(val) => setCurrency(val as Currency)}
              isLightMode={isLightMode}
              label="Currency"
              size="sm"
            />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={totalAlphaSoldData}>
            <defs>
              <linearGradient id="alphaSoldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.teal} stopOpacity={0.55} />
                <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="date"
              stroke={axisColor}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={22}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              stroke={axisColor}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(val) => currency === 'TAO' ? formatCompactNumber(val) : formatCompactCurrency(val, '$')}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={axisColor}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              domain={priceSumDomain}
              tickCount={5}
              tickFormatter={(val) => Number(val).toFixed(2)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              formatter={(value: number, name: string, props) => {
                if (props.dataKey === 'priceSum') {
                  return [Number(value).toFixed(2), 'Subnet Sum of Prices'];
                }
                const label = currency === 'TAO' ? 'TAO sold' : 'USD sold';
                return [currency === 'TAO' ? formatTAO(value) : formatCurrency(value), label];
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '12px', fontSize: '11px', color: axisColor }}
            />
            <Area
              type="monotone"
              dataKey={currency === 'TAO' ? 'tao' : 'usd'}
              yAxisId="left"
              name={currency === 'TAO' ? 'Total Miner Swaps' : 'Total Miner Swaps'}
              stroke={CHART_COLORS.teal}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#alphaSoldGradient)"
            />
            <Line
              type="monotone"
              dataKey="priceSum"
              yAxisId="right"
              name="Subnet Sum of Prices"
              stroke={CHART_COLORS.indigo}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Alpha Sales by Subnet */}
      <div
        className={`rounded-3xl border backdrop-blur-xl p-8 shadow-xl ${
          isLightMode
            ? 'border-slate-200 bg-white/90 shadow-slate-200/40'
            : 'border-white/5 bg-slate-900/40 shadow-black/30'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className={`text-2xl font-semibold mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
              Miner Alpha Sales by Subnet
            </h2>
            <p className={`text-base leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Breakdown of Alpha rewards swaps across top 10 subnets by volume
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <SegmentedToggle
              value={timeframe}
              options={[
                { value: '30d', label: '30D' },
                { value: '90d', label: '90D' },
                { value: 'all', label: 'All' }
              ]}
              onChange={(val) => setTimeframe(val as Timeframe)}
              isLightMode={isLightMode}
              label="Timeframe"
              size="sm"
            />
            <SegmentedToggle
              value={currency}
              options={[
                { value: 'TAO', label: 'TAO' },
                { value: 'USD', label: 'USD' }
              ]}
              onChange={(val) => setCurrency(val as Currency)}
              isLightMode={isLightMode}
              label="Currency"
              size="sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Stacked Area Chart (70%) */}
          <div className="lg:col-span-8">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={alphaBySubnetData.stackedData}>
                <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={22}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={(val) => currency === 'TAO' ? formatCompactNumber(val) : formatCompactCurrency(val, '$')}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) =>
                    currency === 'TAO' ? formatTAO(value) : formatCurrency(value)
                  }
                />
                {alphaBySubnetData.top10.map((subnet, idx) => (
                  <Area
                    key={subnet.subnetId}
                    type="monotone"
                    dataKey={subnet.subnetId}
                    stackId="1"
                    stroke={PALETTE_10[idx]}
                    fill={PALETTE_10[idx]}
                    fillOpacity={0.42}
                    strokeWidth={1.5}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart (30%) */}
          <div className="lg:col-span-4">
            <div className="mb-4">
              <div className={`text-[11px] uppercase tracking-[0.22em] font-semibold ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Cumulative Sales Share
              </div>
              <div className={`text-xs mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
                Share of total miner sales by subnet over the selected period
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={alphaBySubnetData.pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, x, y, textAnchor }) =>
                    percent > 0.08 ? (
                      <text
                        x={x}
                        y={y}
                        textAnchor={textAnchor}
                        fill={axisColor}
                        fontSize={11}
                        fontWeight={500}
                      >
                        {`${truncateLabel(name, 12)} ${(percent * 100).toFixed(0)}%`}
                      </text>
                    ) : null
                  }
                  innerRadius={70}
                  outerRadius={125}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {alphaBySubnetData.pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PALETTE_10[index % PALETTE_10.length]}
                      stroke={isLightMode ? '#f8fafc' : '#0f172a'}
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) =>
                    currency === 'TAO' ? formatTAO(value) : formatCurrency(value)
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 3: Sell-Through Rates - Dual Bar Comparison */}
      <div className={`rounded-3xl border backdrop-blur-xl p-8 shadow-xl ${
        isLightMode
          ? 'border-slate-200 bg-white/90 shadow-slate-200/40'
          : 'border-white/5 bg-slate-900/40 shadow-black/30'
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h2 className={`text-2xl font-semibold mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
              Miner Selling Ratio
            </h2>
            <p className={`text-base leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Alpha sold by miners vs. Alpha received by miners (daily average)
            </p>
          </div>
          <SegmentedToggle
            value={sellThroughPeriod}
            options={[
              { value: '7d', label: '7D' },
              { value: '30d', label: '30D' },
              { value: '90d', label: '90D' },
              { value: 'all', label: 'All' }
            ]}
            onChange={(val) => setSellThroughPeriod(val as TopMoversPeriod)}
            isLightMode={isLightMode}
            label="Period"
            size="sm"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Highest Sell-Through */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-rose-700 to-red-800 shadow-sm" />
              <div>
                <h3 className={`text-lg font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Highest Sell Pressure
                </h3>
                <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Top 5 subnets with highest selling activity
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={sellThroughData.highest5.map(s => ({
                name: s.subnetName,
                rate: s.avgSellThroughRate
              }))}>
                <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={16}
                  tickFormatter={(value) => truncateLabel(String(value), 10)}
                />
                <YAxis
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={(val) => `${val.toFixed(0)}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                  {sellThroughData.highest5.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#gradientRose${index})`} />
                  ))}
                </Bar>
                <defs>
                  {sellThroughData.highest5.map((_, index) => (
                    <linearGradient key={index} id={`gradientRose${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={CHART_COLORS.red} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Lowest Sell-Through */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-emerald-700 to-teal-800 shadow-sm" />
              <div>
                <h3 className={`text-lg font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Lowest Sell Pressure
                </h3>
                <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Top 5 subnets with lowest selling activity
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={sellThroughData.lowest5.map(s => ({
                name: s.subnetName,
                rate: s.avgSellThroughRate
              }))}>
                <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={16}
                  tickFormatter={(value) => truncateLabel(String(value), 10)}
                />
                <YAxis
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={(val) => `${val.toFixed(0)}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                  {sellThroughData.lowest5.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#gradientEmerald${index})`} />
                  ))}
                </Bar>
                <defs>
                  {sellThroughData.lowest5.map((_, index) => (
                    <linearGradient key={index} id={`gradientEmerald${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 5: Holding Period Distribution - Vertical Bars */}
      <div
        className={`rounded-3xl border backdrop-blur-xl p-8 shadow-xl ${
          isLightMode
            ? 'border-slate-200 bg-white/90 shadow-slate-200/40'
            : 'border-white/5 bg-slate-900/40 shadow-black/30'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h2 className={`text-2xl font-semibold mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
              Miner Holding Period Distribution
            </h2>
            <p className={`text-base leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Average time between miner Alpha emissions and swap to TAO
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <SegmentedToggle
              value={holdingPeriodMode}
              options={[
                { value: 'worst', label: 'Top 10 Worst' },
                { value: 'best', label: 'Top 10 Best' },
                { value: 'custom', label: 'Custom' }
              ]}
              onChange={(val) => {
                const mode = val as HoldingPeriodMode;
                setHoldingPeriodMode(mode);
                if (mode === 'custom') {
                  setShowHoldingSelector(customSubnets.length === 0);
                } else {
                  setShowHoldingSelector(false);
                }
              }}
              isLightMode={isLightMode}
              label="Mode"
            />
            <SegmentedToggle
              value={holdingPeriodTimeframe}
              options={[
                { value: '1d', label: '1D' },
                { value: '7d', label: '7D' },
                { value: '30d', label: '30D' },
                { value: '90d', label: '90D' },
                { value: 'all', label: 'All' }
              ]}
              onChange={(val) => setHoldingPeriodTimeframe(val as HoldingPeriodTimeframe)}
              isLightMode={isLightMode}
              label="Period"
              size="sm"
            />
            {holdingPeriodMode === 'custom' && (
              <button
                type="button"
                onClick={() => setShowHoldingSelector(prev => !prev)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${
                  isLightMode
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                {showHoldingSelector ? 'Hide Selection' : 'Edit Selection'}
              </button>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={holdingPeriodData} barCategoryGap="15%">
            <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="subnetName"
              stroke={axisColor}
              tick={{ ...axisTick, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              minTickGap={14}
              tickFormatter={(value) => truncateLabel(String(value), 10)}
            />
            <YAxis
              stroke={axisColor}
              tick={{ ...axisTick, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(val) => `${Number(val).toFixed(0)}%`}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => `${value.toFixed(1)}%`}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
            />
            <Legend
              wrapperStyle={{
                paddingTop: '16px',
                fontSize: '11px',
                color: axisColor
              }}
              iconType="rect"
              iconSize={12}
            />
            <Bar dataKey="<1d" name="< 1 day" stackId="a" fill={HOLDING_COLORS.short} radius={[4, 4, 0, 0]} />
            <Bar dataKey="1-3d" name="1-3 days" stackId="a" fill={HOLDING_COLORS.shortMid} />
            <Bar dataKey="3-7d" name="3-7 days" stackId="a" fill={HOLDING_COLORS.mid} />
            <Bar dataKey="7-14d" name="7-14 days" stackId="a" fill={HOLDING_COLORS.midLong} />
            <Bar dataKey=">14d" name="> 14 days" stackId="a" fill={HOLDING_COLORS.long} />
          </BarChart>
        </ResponsiveContainer>

        {/* Custom Subnet Grid */}
        {holdingPeriodMode === 'custom' && showHoldingSelector && (
          <div className={`mt-8 pt-6 border-t ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                Select Subnets (Max 10)
              </h3>
              <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide ${
                isLightMode
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-slate-900/60 text-slate-300'
              }`}>
                {customSubnets.length}/10 selected
              </span>
            </div>
            <div className="grid grid-cols-6 md:grid-cols-10 lg:grid-cols-14 gap-2.5">
              {flattenSubnets.slice(0, 50).map(subnet => {
                const subnetNumber = getSubnetNumber(subnet.id);
                return (
                  <SubnetLogoButton
                    key={subnet.id}
                    subnet={subnet}
                    subnetNumber={subnetNumber}
                    selected={customSubnets.includes(subnet.id)}
                    onClick={() => toggleSubnetSelection(subnet.id)}
                    isLightMode={isLightMode}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Chart 6: Top Movers - Vertical Bar Charts */}
      <div className={`rounded-3xl border backdrop-blur-xl p-8 shadow-xl ${
        isLightMode
          ? 'border-slate-200 bg-white/90 shadow-slate-200/40'
          : 'border-white/5 bg-slate-900/40 shadow-black/30'
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h2 className={`text-2xl font-semibold mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
              Miner Unstaking Speed Comparison
            </h2>
            <p className={`text-base leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Average time between Alpha rewards emitted to miners and swap to TAO
            </p>
          </div>
          <SegmentedToggle
            value={topMoversPeriod}
            options={[
              { value: '7d', label: '7D' },
              { value: '30d', label: '30D' },
              { value: '90d', label: '90D' },
              { value: 'all', label: 'All' }
            ]}
            onChange={(val) => setTopMoversPeriod(val as TopMoversPeriod)}
            isLightMode={isLightMode}
            label="Period"
            size="sm"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Fastest to Unstake */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-rose-700 to-red-800 shadow-sm" />
              <div>
                <h3 className={`text-lg font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Fastest to Unstake
                </h3>
                <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Most extractive behavior
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topMoversData.fastest.map(s => ({
                name: s.subnetName,
                days: s.avgHoldingDays
              }))}>
                <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={16}
                  tickFormatter={(value) => truncateLabel(String(value), 10)}
                />
                <YAxis
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={(val) => `${val.toFixed(0)}d`}
                  label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `${value.toFixed(1)} days`}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="days" radius={[6, 6, 0, 0]}>
                  {topMoversData.fastest.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#gradientFastRose${index})`} />
                  ))}
                </Bar>
                <defs>
                  {topMoversData.fastest.map((_, index) => (
                    <linearGradient key={index} id={`gradientFastRose${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={CHART_COLORS.red} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Slowest to Unstake */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-emerald-700 to-teal-800 shadow-sm" />
              <div>
                <h3 className={`text-lg font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Slowest to Unstake
                </h3>
                <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Most aligned behavior
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topMoversData.slowest.map(s => ({
                name: s.subnetName,
                days: s.avgHoldingDays
              }))}>
                <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={16}
                  tickFormatter={(value) => truncateLabel(String(value), 10)}
                />
                <YAxis
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={(val) => `${val.toFixed(0)}d`}
                  label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `${value.toFixed(1)} days`}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="days" radius={[6, 6, 0, 0]}>
                  {topMoversData.slowest.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#gradientSlowEmerald${index})`} />
                  ))}
                </Bar>
                <defs>
                  {topMoversData.slowest.map((_, index) => (
                    <linearGradient key={index} id={`gradientSlowEmerald${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 7: Sensitivity Analysis */}
      <div
        className={`rounded-3xl border backdrop-blur-xl p-8 shadow-xl ${
          isLightMode
            ? 'border-slate-200 bg-white/90 shadow-slate-200/40'
            : 'border-white/5 bg-slate-900/40 shadow-black/30'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h2 className={`text-2xl font-semibold mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
              Subnet Prices vs. Miner Selling Correlation
            </h2>
            <p className={`text-base leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Correlation between subnets price increase and miner selling pressure
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBetaSelector(prev => !prev)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${
              isLightMode
                ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <Plus size={14} />
            {showBetaSelector ? 'Hide Subnets' : 'Add Subnets'}
          </button>
        </div>

        <div className={`rounded-2xl border p-6 ${isLightMode ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-950/40'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`text-[11px] uppercase tracking-[0.3em] font-semibold ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Miner Extraction Beta (30D ROLLING)
            </div>
            <div className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
              Network + selected subnets
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={betaSeriesData}>
              <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={axisColor}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={22}
              />
              <YAxis
                stroke={axisColor}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                domain={[0.2, 2]}
                tickFormatter={(val) => Number(val).toFixed(2)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                formatter={(value: number) => Number(value).toFixed(2)}
              />
              <Legend
                wrapperStyle={{ paddingTop: '12px', fontSize: '11px', color: axisColor }}
              />
              <Line
                type="monotone"
                dataKey="networkBeta"
                name="Network Beta"
                stroke={CHART_COLORS.steel}
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              {betaSubnets.map((subnetId, index) => (
                <Line
                  key={subnetId}
                  type="monotone"
                  dataKey={subnetId}
                  name={subnetNameLookup.get(subnetId) ?? subnetId}
                  stroke={PALETTE_10[index % PALETTE_10.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {showBetaSelector && (
          <div className={`mt-6 pt-6 border-t ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                Select Subnets (Max 5)
              </h3>
              <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide ${
                isLightMode
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-slate-900/60 text-slate-300'
              }`}>
                {betaSubnets.length}/5 selected
              </span>
            </div>
            <div className="grid grid-cols-6 md:grid-cols-10 lg:grid-cols-14 gap-2.5">
              {flattenSubnets.slice(0, 50).map(subnet => {
                const subnetNumber = getSubnetNumber(subnet.id);
                return (
                  <SubnetLogoButton
                    key={subnet.id}
                    subnet={subnet}
                    subnetNumber={subnetNumber}
                    selected={betaSubnets.includes(subnet.id)}
                    onClick={() => toggleBetaSubnet(subnet.id)}
                    isLightMode={isLightMode}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-indigo-700 to-slate-800 shadow-sm" />
              <div>
                <h3 className={`text-lg font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Highest Extraction Beta
                </h3>
                <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Subnets where miner selling is most sensitive to price upside
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={betaRankings.highest.map(s => ({
                name: s.subnetName,
                beta: s.avgBeta
              }))}>
                <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={16}
                  tickFormatter={(value) => truncateLabel(String(value), 10)}
                />
                <YAxis
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  domain={[0, 2]}
                  tickFormatter={(val) => Number(val).toFixed(2)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) => Number(value).toFixed(2)}
                />
                <Bar dataKey="beta" radius={[6, 6, 0, 0]}>
                  {betaRankings.highest.map((entry, index) => (
                    <Cell key={`cell-high-${index}`} fill={`url(#gradientBetaHigh${index})`} />
                  ))}
                </Bar>
                <defs>
                  {betaRankings.highest.map((_, index) => (
                    <linearGradient key={index} id={`gradientBetaHigh${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.indigo} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={CHART_COLORS.slate} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-emerald-700 to-teal-800 shadow-sm" />
              <div>
                <h3 className={`text-lg font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Lowest Extraction Beta
                </h3>
                <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Subnets where miner selling is least sensitive to price moves
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={betaRankings.lowest.map(s => ({
                name: s.subnetName,
                beta: s.avgBeta
              }))}>
                <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={16}
                  tickFormatter={(value) => truncateLabel(String(value), 10)}
                />
                <YAxis
                  stroke={axisColor}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  domain={[0, 2]}
                  tickFormatter={(val) => Number(val).toFixed(2)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) => Number(value).toFixed(2)}
                />
                <Bar dataKey="beta" radius={[6, 6, 0, 0]}>
                  {betaRankings.lowest.map((entry, index) => (
                    <Cell key={`cell-low-${index}`} fill={`url(#gradientBetaLow${index})`} />
                  ))}
                </Bar>
                <defs>
                  {betaRankings.lowest.map((_, index) => (
                    <linearGradient key={index} id={`gradientBetaLow${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 8: Miner Dump/Pump Response */}
      <div className={`rounded-3xl border backdrop-blur-xl p-8 shadow-xl ${
        isLightMode
          ? 'border-slate-200 bg-white/90 shadow-slate-200/40'
          : 'border-white/5 bg-slate-900/40 shadow-black/30'
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h2 className={`text-2xl font-semibold mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
              Miner Dump/Pump Response
            </h2>
            <p className={`text-base leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              How does miner sell pressure change in extreme price movements?
            </p>
          </div>
          <SegmentedToggle
            value={correlationPeriod}
            options={[
              { value: '7d', label: '7D' },
              { value: '30d', label: '30D' },
              { value: '90d', label: '90D' },
              { value: 'all', label: 'All' }
            ]}
            onChange={(val) => setCorrelationPeriod(val as CorrelationPeriod)}
            isLightMode={isLightMode}
            label="Period"
            size="sm"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-rose-700 to-red-800 shadow-sm" />
              <div>
                <h3 className={`text-lg font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Miner Dump Response
                </h3>
                <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Average miner selling pressure move in extreme price drops (-1σ) 
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <div className={`text-xs uppercase tracking-[0.2em] font-semibold mb-3 ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Best
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dumpPumpResponseData.dumpBest.map(item => ({
                    name: item.subnetName,
                    delta: item.dumpResponse
                  }))}>
                    <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke={axisColor}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      minTickGap={16}
                      tickFormatter={(value) => truncateLabel(String(value), 10)}
                    />
                    <YAxis
                      stroke={axisColor}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(val) => `${Number(val).toFixed(1)}%`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(value: number) => `${value.toFixed(2)}%`}
                    />
                    <Bar dataKey="delta" radius={[6, 6, 0, 0]}>
                      {dumpPumpResponseData.dumpBest.map((entry, index) => (
                        <Cell key={`cell-dump-best-${index}`} fill={`url(#gradientDumpBest${index})`} />
                      ))}
                    </Bar>
                    <defs>
                      {dumpPumpResponseData.dumpBest.map((_, index) => (
                        <linearGradient key={index} id={`gradientDumpBest${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.85} />
                          <stop offset="100%" stopColor={CHART_COLORS.red} stopOpacity={0.6} />
                        </linearGradient>
                      ))}
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className={`text-xs uppercase tracking-[0.2em] font-semibold mb-3 ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Worst
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dumpPumpResponseData.dumpWorst.map(item => ({
                    name: item.subnetName,
                    delta: item.dumpResponse
                  }))}>
                    <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke={axisColor}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      minTickGap={16}
                      tickFormatter={(value) => truncateLabel(String(value), 10)}
                    />
                    <YAxis
                      stroke={axisColor}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(val) => `${Number(val).toFixed(1)}%`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(value: number) => `${value.toFixed(2)}%`}
                    />
                    <Bar dataKey="delta" radius={[6, 6, 0, 0]}>
                      {dumpPumpResponseData.dumpWorst.map((entry, index) => (
                        <Cell key={`cell-dump-worst-${index}`} fill={`url(#gradientDumpWorst${index})`} />
                      ))}
                    </Bar>
                    <defs>
                      {dumpPumpResponseData.dumpWorst.map((_, index) => (
                        <linearGradient key={index} id={`gradientDumpWorst${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={CHART_COLORS.red} stopOpacity={0.45} />
                        </linearGradient>
                      ))}
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-emerald-700 to-teal-800 shadow-sm" />
              <div>
                <h3 className={`text-lg font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  Miner Pump Response
                </h3>
                <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Average miner selling pressure move in extreme price surges (+1σ) 
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <div className={`text-xs uppercase tracking-[0.2em] font-semibold mb-3 ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Best
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dumpPumpResponseData.pumpBest.map(item => ({
                    name: item.subnetName,
                    delta: item.pumpResponse
                  }))}>
                    <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke={axisColor}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      minTickGap={16}
                      tickFormatter={(value) => truncateLabel(String(value), 10)}
                    />
                    <YAxis
                      stroke={axisColor}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(val) => `${Number(val).toFixed(1)}%`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(value: number) => `${value.toFixed(2)}%`}
                    />
                    <Bar dataKey="delta" radius={[6, 6, 0, 0]}>
                      {dumpPumpResponseData.pumpBest.map((entry, index) => (
                        <Cell key={`cell-pump-best-${index}`} fill={`url(#gradientPumpBest${index})`} />
                      ))}
                    </Bar>
                    <defs>
                      {dumpPumpResponseData.pumpBest.map((_, index) => (
                        <linearGradient key={index} id={`gradientPumpBest${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.85} />
                          <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0.6} />
                        </linearGradient>
                      ))}
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className={`text-xs uppercase tracking-[0.2em] font-semibold mb-3 ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Worst
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dumpPumpResponseData.pumpWorst.map(item => ({
                    name: item.subnetName,
                    delta: item.pumpResponse
                  }))}>
                    <CartesianGrid strokeDasharray="4 6" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke={axisColor}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      minTickGap={16}
                      tickFormatter={(value) => truncateLabel(String(value), 10)}
                    />
                    <YAxis
                      stroke={axisColor}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(val) => `${Number(val).toFixed(1)}%`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(value: number) => `${value.toFixed(2)}%`}
                    />
                    <Bar dataKey="delta" radius={[6, 6, 0, 0]}>
                      {dumpPumpResponseData.pumpWorst.map((entry, index) => (
                        <Cell key={`cell-pump-worst-${index}`} fill={`url(#gradientPumpWorst${index})`} />
                      ))}
                    </Bar>
                    <defs>
                      {dumpPumpResponseData.pumpWorst.map((_, index) => (
                        <linearGradient key={index} id={`gradientPumpWorst${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0.45} />
                        </linearGradient>
                      ))}
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
