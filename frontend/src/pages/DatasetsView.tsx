import React, { useMemo, useState } from 'react';
import { useSubnetsData } from '../context/DataContext';
import {
  Database,
  ChevronRight,
  GitBranch,
  MessageSquare,
  Users,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sun,
  Moon
} from 'lucide-react';

// Category mapping from user requirements to actual data categories
const CATEGORY_MAP: Record<string, string[]> = {
  'All': [], // Empty means show all
  'Compute': ['Compute & Infrastructure'],
  'Predictions': ['Predictions Markets'],
  'Trading': ['Trading & DeFi'],
  'Agents': ['AI Agents'],
  'Mining': ['Mining & Resources'],
  'Physical AI': ['Physical AI'],
  'Data': ['Data & Storage'],
  'DeSci': ['DeSci'],
  'AI tools': ['AI Tools & Applications'],
  'Others': ['Other', 'Entertainment', 'Social']
};

const SIDEBAR_CATEGORIES = [
  'All',
  'Compute',
  'Predictions',
  'Trading',
  'Agents',
  'Mining',
  'Physical AI',
  'Data',
  'DeSci',
  'AI tools',
  'Others'
];

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'technical', label: 'Technical' },
  { id: 'on-chain', label: 'On-Chain' },
  { id: 'development', label: 'Development' },
  { id: 'social', label: 'Social' },
  { id: 'miner-flows', label: 'Miner Flows' }
];

interface SubnetData {
  id: string;
  name: string;
  category: string;
  price: number;
  priceChange1Day: number;
  emissions: number;
  marketCap: number;
  rank: number;
}

type SortKey =
  | 'rank'
  | 'name'
  | 'price'
  | 'priceChange1Day'
  | 'emissions'
  | 'marketCap'
  | 'xFollowers'
  | 'discordMessages30d'
  | 'githubCommits30d'
  | 'websiteTraffic30d'
  | 'taoInflow'
  | 'minerSales1d'
  | 'minerSales7d'
  | 'minerSales30d'
  | 'minerSellingRatio30d'
  | 'percentSold1d'
  | 'percentSold3d'
  | 'percentSold7d'
  | 'percentSold14d'
  | 'percentSoldOver30d'
  | 'avgHoldingDays30d'
  | 'minerExtractionBeta'
  | 'minerDumpResponse'
  | 'minerPumpResponse';

const MINER_FLOW_TAO_PRICE = 350;

const formatTAO = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `τ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
};

const formatTAOCompact = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `τ${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const formatCurrencyCompact = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(1)}`;
};

const formatPercentage = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US');
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
};

const formatSignedPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const seededRandom = (seed: number, offset: number) => {
  return (Math.sin(seed * 19 + offset * 7) + 1) / 2;
};

// Mock data generator for columns we don't have yet
const generateMockData = (subnetId: string) => {
  const seed = parseInt(subnetId.replace('SN', '')) || 0;
  const w1 = 10 + seededRandom(seed, 5) * 20;
  const w2 = 12 + seededRandom(seed, 6) * 18;
  const w3 = 15 + seededRandom(seed, 7) * 20;
  const w4 = 18 + seededRandom(seed, 8) * 22;
  const w5 = 8 + seededRandom(seed, 9) * 15;
  const totalW = w1 + w2 + w3 + w4 + w5;
  const percentSold1d = (w1 / totalW) * 100;
  const percentSold3d = (w2 / totalW) * 100;
  const percentSold7d = (w3 / totalW) * 100;
  const percentSold14d = (w4 / totalW) * 100;
  const percentSoldOver30d = (w5 / totalW) * 100;

  const minerSales1dTao = 8 + seededRandom(seed, 1) * 70;
  const minerSales7dTao = minerSales1dTao * (5 + seededRandom(seed, 2) * 3);
  const minerSales30dTao = minerSales7dTao * (3 + seededRandom(seed, 3) * 2.5);
  const minerSellingRatio30d = 30 + seededRandom(seed, 4) * 55;

  const avgHoldingDays30d = (
    percentSold1d * 1 +
    percentSold3d * 3 +
    percentSold7d * 7 +
    percentSold14d * 14 +
    percentSoldOver30d * 45
  ) / 100;

  return {
    xFollowers: Math.floor(1000 + (seed * 137) % 50000),
    discordMessages30d: Math.floor(50 + (seed * 239) % 5000),
    daysSinceLastDiscord: Math.floor((seed * 73) % 30),
    githubCommits30d: Math.floor(5 + (seed * 97) % 500),
    daysSinceLastCommit: Math.floor((seed * 53) % 14),
    websiteTraffic30d: Math.floor(500 + (seed * 317) % 100000),
    taoInflow: Math.floor(100 + (seed * 421) % 10000) / 100, // TAO inflow
    taoInflow7d: ((seed * 89) % 200 - 100) / 10, // 7d change in %
    emissions7d: ((seed * 113) % 200 - 100) / 10, // 7d emissions change in %
    minerSales1d: minerSales1dTao,
    minerSales7d: minerSales7dTao,
    minerSales30d: minerSales30dTao,
    minerSellingRatio30d,
    percentSold1d,
    percentSold3d,
    percentSold7d,
    percentSold14d,
    percentSoldOver30d,
    avgHoldingDays30d,
    minerExtractionBeta: 0.6 + seededRandom(seed, 10) * 0.9,
    minerDumpResponse: -12 + seededRandom(seed, 11) * 24,
    minerPumpResponse: -6 + seededRandom(seed, 12) * 18
  };
};

const DatasetsView: React.FC = () => {
  const { data: subnetsData, loading } = useSubnetsData();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('overview');
  const [isLightMode, setIsLightMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [minerFlowsCurrency, setMinerFlowsCurrency] = useState<'TAO' | 'USD'>('TAO');
  const [activeInfoKey, setActiveInfoKey] = useState<string | null>(null);

  // Flatten and filter subnets based on selected category and search
  const filteredSubnets = useMemo(() => {
    if (!subnetsData) return [];

    const flatSubnets: SubnetData[] = [];

    subnetsData.forEach(category => {
      category.subnets.forEach(subnet => {
        // Check if this subnet's category matches the selected filter
        const matchesCategory = selectedCategory === 'All' ||
          (CATEGORY_MAP[selectedCategory] || []).some(cat =>
            category.name.toLowerCase().includes(cat.toLowerCase()) ||
            (subnet.category || '').toLowerCase().includes(cat.toLowerCase())
          );

        // Check if matches search query
        const matchesSearch = !searchQuery ||
          subnet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          subnet.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (subnet.category || '').toLowerCase().includes(searchQuery.toLowerCase());

        if (matchesCategory && matchesSearch) {
          flatSubnets.push({
            id: subnet.id,
            name: subnet.name,
            category: subnet.category || category.name,
            price: subnet.price || 0,
            priceChange1Day: subnet.priceChange1Day || 0,
            emissions: subnet.emissions || 0,
            marketCap: subnet.marketCap || 0,
            rank: subnet.rank || 0
          });
        }
      });
    });

    return flatSubnets;
  }, [subnetsData, selectedCategory, searchQuery]);

  // Sort subnets
  const sortedSubnets = useMemo(() => {
    const sorted = [...filteredSubnets];

    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortKey === 'name') {
        aVal = a.name;
        bVal = b.name;
      } else if (sortKey === 'rank') {
        aVal = a.rank;
        bVal = b.rank;
      } else if (sortKey === 'price') {
        aVal = a.price;
        bVal = b.price;
      } else if (sortKey === 'priceChange1Day') {
        aVal = a.priceChange1Day;
        bVal = b.priceChange1Day;
      } else if (sortKey === 'emissions') {
        aVal = a.emissions;
        bVal = b.emissions;
      } else if (sortKey === 'marketCap') {
        aVal = a.marketCap;
        bVal = b.marketCap;
      } else {
        // For mock data columns
        const aMock = generateMockData(a.id);
        const bMock = generateMockData(b.id);
        aVal = aMock[sortKey as keyof typeof aMock] || 0;
        bVal = bMock[sortKey as keyof typeof bMock] || 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return sorted;
  }, [filteredSubnets, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    setActiveInfoKey(null);
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const formatMinerFlowValue = (taoValue: number) => {
    return minerFlowsCurrency === 'TAO'
      ? formatTAOCompact(taoValue)
      : formatCurrencyCompact(taoValue * MINER_FLOW_TAO_PRICE);
  };

  const toggleInfoKey = (key: string) => {
    setActiveInfoKey(prev => (prev === key ? null : key));
  };

  const minerFlowsGrid = 'grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_repeat(10,minmax(0,1fr))] gap-4';
  const minerFlowsInfo = {
    rank: 'Subnet rank by market cap within the datasets list.',
    subnet: 'Subnet name and subnet id.',
    minerSales30d: 'Estimated miner TAO sold over the last 30 days.',
    minerSellingRatio30d: 'Miner sales divided by miner emissions over 30 days (selling pressure, %).',
    percentSold1d: 'Share of emissions sold within 1 day.',
    percentSold7d: 'Share of emissions sold within 7 days.',
    percentSold14d: 'Share of emissions sold within 14 days.',
    percentSoldOver30d: 'Share of emissions sold after 30+ days.',
    avgHoldingDays30d: 'Weighted average days between emission and sale over 30 days.',
    minerExtractionBeta: 'Sensitivity of selling ratio to market moves; higher means more extractive.',
    minerDumpResponse: 'Change in avg selling ratio when returns < -1 std dev vs >= -1 std dev.',
    minerPumpResponse: 'Change in avg selling ratio when returns > +1 std dev vs <= +1 std dev.'
  };

  const minerFlowLabel = (label: string, info: string, key: string) => {
    const isOpen = activeInfoKey === key;
    return (
      <span className="relative inline-flex items-center gap-1 group">
        <span>{label}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            toggleInfoKey(key);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              toggleInfoKey(key);
            }
          }}
          className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[9px] font-bold cursor-pointer ${
            isLightMode
              ? 'bg-white border border-slate-300 text-slate-500'
              : 'bg-slate-900/60 border border-white/10 text-slate-400'
          }`}
          aria-label={info}
          aria-pressed={isOpen}
        >
          i
        </span>
        <span
          className={`pointer-events-none absolute left-0 top-full mt-2 w-56 rounded-lg border px-2.5 py-2 text-[11px] leading-snug shadow-lg transition-all z-30 ${
            isLightMode
              ? 'bg-white border-slate-200 text-slate-600'
              : 'bg-slate-900 border-white/10 text-slate-300'
          } ${
            isOpen
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
          }`}
        >
          {info}
        </span>
      </span>
    );
  };

  const minerFlowsAggregates = useMemo(() => {
    if (sortedSubnets.length === 0) return null;

    let totalSales30d = 0;
    let avgSellingRatio30d = 0;
    let avgPercentSold1d = 0;
    let avgPercentSold7d = 0;
    let avgPercentSold14d = 0;
    let avgPercentSoldOver30d = 0;
    let avgHoldingDays30d = 0;
    let avgExtractionBeta = 0;
    let avgDumpResponse = 0;
    let avgPumpResponse = 0;

    sortedSubnets.forEach(subnet => {
      const mock = generateMockData(subnet.id);
      totalSales30d += mock.minerSales30d;
      avgSellingRatio30d += mock.minerSellingRatio30d;
      avgPercentSold1d += mock.percentSold1d;
      avgPercentSold7d += mock.percentSold7d;
      avgPercentSold14d += mock.percentSold14d;
      avgPercentSoldOver30d += mock.percentSoldOver30d;
      avgHoldingDays30d += mock.avgHoldingDays30d;
      avgExtractionBeta += mock.minerExtractionBeta;
      avgDumpResponse += mock.minerDumpResponse;
      avgPumpResponse += mock.minerPumpResponse;
    });

    const count = sortedSubnets.length;

    return {
      count,
      totalSales30d,
      avgSellingRatio30d: avgSellingRatio30d / count,
      avgPercentSold1d: avgPercentSold1d / count,
      avgPercentSold7d: avgPercentSold7d / count,
      avgPercentSold14d: avgPercentSold14d / count,
      avgPercentSoldOver30d: avgPercentSoldOver30d / count,
      avgHoldingDays30d: avgHoldingDays30d / count,
      avgExtractionBeta: avgExtractionBeta / count,
      avgDumpResponse: avgDumpResponse / count,
      avgPumpResponse: avgPumpResponse / count
    };
  }, [sortedSubnets]);

  // Calculate aggregates
  const aggregates = useMemo(() => {
    if (sortedSubnets.length === 0) return null;

    const totalMarketCap = sortedSubnets.reduce((sum, s) => sum + s.marketCap, 0);
    const avgPrice = sortedSubnets.reduce((sum, s) => sum + s.price, 0) / sortedSubnets.length;
    const avgPriceChange = sortedSubnets.reduce((sum, s) => sum + s.priceChange1Day, 0) / sortedSubnets.length;
    const totalEmissions = sortedSubnets.reduce((sum, s) => sum + s.emissions, 0);

    let totalXFollowers = 0;
    let totalDiscordMessages = 0;
    let totalGithubCommits = 0;
    let totalWebsiteTraffic = 0;
    let totalTaoInflow = 0;
    let avgTaoInflow7d = 0;
    let avgEmissions7d = 0;

    sortedSubnets.forEach(subnet => {
      const mock = generateMockData(subnet.id);
      totalXFollowers += mock.xFollowers;
      totalDiscordMessages += mock.discordMessages30d;
      totalGithubCommits += mock.githubCommits30d;
      totalWebsiteTraffic += mock.websiteTraffic30d;
      totalTaoInflow += mock.taoInflow;
      avgTaoInflow7d += mock.taoInflow7d;
      avgEmissions7d += mock.emissions7d;
    });

    avgTaoInflow7d /= sortedSubnets.length;
    avgEmissions7d /= sortedSubnets.length;

    return {
      count: sortedSubnets.length,
      totalMarketCap,
      avgPrice,
      avgPriceChange,
      totalEmissions,
      totalXFollowers,
      totalDiscordMessages,
      totalGithubCommits,
      totalWebsiteTraffic,
      totalTaoInflow,
      avgTaoInflow7d,
      avgEmissions7d
    };
  }, [sortedSubnets]);

  const SortableHeader: React.FC<{
    label: React.ReactNode;
    sortKey: SortKey;
    align?: 'left' | 'right';
  }> = ({ label, sortKey: key, align = 'left' }) => {
    const isActive = sortKey === key;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleSort(key)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleSort(key);
          }
        }}
        className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-bold transition-colors cursor-pointer ${
          align === 'right' ? 'ml-auto' : ''
        } ${
          isActive
            ? isLightMode ? 'text-slate-900' : 'text-white'
            : isLightMode ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
        }`}
      >
        <span>{label}</span>
        {isActive ? (
          sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-30" />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLightMode ? 'bg-slate-50' : 'bg-slate-950'}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${isLightMode ? 'border-teal-600' : 'border-teal-400'}`}></div>
          <p className={`text-sm ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>Loading datasets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${
      isLightMode ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-white'
    }`}>
      {/* Fixed gradient background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {isLightMode ? (
          <>
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-500/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
          </>
        ) : (
          <>
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-500/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px]" />
          </>
        )}
      </div>

      {/* Vertical Sidebar */}
      <aside className={`relative z-10 w-64 border-r backdrop-blur-2xl ${
        isLightMode
          ? 'bg-white/95 border-slate-200'
          : 'bg-slate-950/40 border-white/5'
      }`}>
        <div className={`p-6 border-b ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Database size={20} className="text-white" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-teal-400 font-bold">TAO Galaxy</div>
              <div className={`text-xl font-bold tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Datasets</div>
            </div>
          </div>
          <p className={`text-xs mt-2 ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
            Comprehensive subnet analytics platform
          </p>
        </div>

        <nav className="p-4">
          <div className={`text-[10px] uppercase tracking-[0.2em] font-bold mb-3 px-3 ${
            isLightMode ? 'text-slate-500' : 'text-slate-500'
          }`}>
            Categories
          </div>
          <div className="space-y-1">
            {SIDEBAR_CATEGORIES.map(category => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`
                    w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-between group
                    ${isActive
                      ? isLightMode
                        ? 'bg-gradient-to-r from-teal-500/10 to-indigo-500/5 border border-teal-500/20 text-slate-900'
                        : 'bg-gradient-to-r from-teal-500/10 to-indigo-500/5 border border-teal-500/20 text-white'
                      : isLightMode
                        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <span className="text-sm font-medium">{category}</span>
                  {isActive && (
                    <ChevronRight size={14} className="text-teal-400" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Stats Card */}
        <div className={`p-4 mx-4 mt-6 rounded-2xl border ${
          isLightMode
            ? 'border-slate-200 bg-slate-100/50'
            : 'border-white/5 bg-slate-900/40'
        }`}>
          <div className={`text-xs uppercase tracking-[0.2em] mb-2 ${
            isLightMode ? 'text-slate-600' : 'text-slate-400'
          }`}>Total Market Cap</div>
          <div className={`text-2xl font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
            {formatCurrency(aggregates?.totalMarketCap || 0)}
          </div>
          <div className={`text-xs mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
            {aggregates?.count || 0} subnets
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="p-4 mt-6">
          <button
            onClick={() => setIsLightMode(!isLightMode)}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
              isLightMode
                ? 'bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700'
                : 'bg-slate-900/60 hover:bg-slate-800/60 border border-white/10 text-slate-300'
            }`}
          >
            {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
            <span className="text-sm font-semibold">
              {isLightMode ? 'Dark Mode' : 'Light Mode'}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`border-b backdrop-blur-xl z-20 ${
          isLightMode
            ? 'bg-white/95 border-slate-200'
            : 'bg-slate-950/40 border-white/5'
        }`}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className={`text-3xl font-bold mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                  {selectedCategory === 'All' ? 'All Subnets' : selectedCategory}
                </h1>
                <p className={`text-sm ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  {selectedCategory === 'All'
                    ? 'Explore all Bittensor subnets with comprehensive metrics'
                    : `${selectedCategory} subnets on the Bittensor network`
                  }
                </p>
              </div>
            </div>

            {/* Search Bar + Currency Toggle */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative max-w-md flex-1 min-w-[240px]">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
                  isLightMode ? 'text-slate-400' : 'text-slate-500'
                }`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subnets..."
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-colors ${
                    isLightMode
                      ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
                      : 'bg-slate-900/60 border-white/10 text-white placeholder-slate-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
                  } focus:outline-none`}
                />
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Currency
                </span>
                <div className="flex items-center gap-2">
                  {(['TAO', 'USD'] as const).map(option => {
                    const isActive = minerFlowsCurrency === option;
                    return (
                      <button
                        key={option}
                        onClick={() => setMinerFlowsCurrency(option)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-teal-500 to-indigo-500 text-white shadow-lg shadow-teal-500/25'
                            : isLightMode
                              ? 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                              : 'bg-slate-900/60 border border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 flex gap-2">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-6 py-3 text-sm font-semibold transition-all duration-200 border-b-2 relative
                    ${isActive
                      ? 'text-teal-400 border-teal-400'
                      : isLightMode
                        ? 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                        : 'text-slate-400 border-transparent hover:text-white hover:border-slate-600'
                    }
                  `}
                >
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400 to-indigo-400 blur-sm" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-28">
          {activeTab === 'overview' && (
            <div className={`rounded-3xl border backdrop-blur-xl overflow-hidden ${
              isLightMode
                ? 'border-slate-200 bg-white/80'
                : 'border-white/5 bg-slate-900/40'
            }`}>
              {/* Table Header */}
              <div className={`grid grid-cols-10 gap-4 px-6 py-4 border-b ${
                isLightMode
                  ? 'bg-slate-100/60 border-slate-200'
                  : 'bg-slate-950/60 border-white/5'
              }`}>
                <div className="col-span-1">
                  <SortableHeader label="Rank" sortKey="rank" />
                </div>
                <div className="col-span-2">
                  <SortableHeader label="Subnet" sortKey="name" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <SortableHeader label="Price (τ)" sortKey="price" align="right" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <SortableHeader label="TAO Emissions %" sortKey="emissions" align="right" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <SortableHeader label="TAO Inflow" sortKey="taoInflow" align="right" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <SortableHeader label="Market Cap" sortKey="marketCap" align="right" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <SortableHeader label="X Followers" sortKey="xFollowers" align="right" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <SortableHeader label="Discord 30D" sortKey="discordMessages30d" align="right" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <SortableHeader label="GitHub 30D" sortKey="githubCommits30d" align="right" />
                </div>
              </div>

              {/* Table Body */}
              <div className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/5'}`}>
                {sortedSubnets.map((subnet) => {
                  const subnetNumber = subnet.id.replace('SN', '');
                  const mockData = generateMockData(subnet.id);
                  const isPositiveChange = subnet.priceChange1Day >= 0;
                  const isPositiveEmissions = mockData.emissions7d >= 0;
                  const isPositiveInflow = mockData.taoInflow7d >= 0;

                  return (
                    <div
                      key={subnet.id}
                      className={`grid grid-cols-10 gap-4 px-6 py-4 transition-colors duration-200 group cursor-pointer ${
                        isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex items-center">
                        <span className={`font-mono text-sm ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                          {subnet.rank}
                        </span>
                      </div>

                      {/* Subnet (Logo + Name) */}
                      <div className="col-span-2 flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl overflow-hidden border flex-shrink-0 ${
                          isLightMode ? 'border-slate-200 bg-slate-100' : 'border-white/10 bg-slate-800/60'
                        }`}>
                          <img
                            src={`/logos/${subnetNumber}.webp`}
                            alt={subnet.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xs font-bold ${isLightMode ? 'text-slate-400' : 'text-slate-500'}">${subnetNumber}</div>`;
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold transition-colors truncate ${
                            isLightMode
                              ? 'text-slate-900 group-hover:text-teal-600'
                              : 'text-white group-hover:text-teal-400'
                          }`}>
                            {subnet.name}
                          </div>
                          <div className={`text-xs font-mono ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            {subnet.id}
                          </div>
                        </div>
                      </div>

                      {/* Price with 24h change below */}
                      <div className="col-span-1 flex items-center justify-end">
                        <div className="text-right">
                          <div className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                            {formatTAO(subnet.price)}
                          </div>
                          <div className={`text-xs font-bold ${isPositiveChange ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {formatPercentage(subnet.priceChange1Day)}
                          </div>
                        </div>
                      </div>

                      {/* TAO Emissions % with 7d change below */}
                      <div className="col-span-1 flex items-center justify-end">
                        <div className="text-right">
                          <div className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-slate-300'}`}>
                            {subnet.emissions.toFixed(2)}%
                          </div>
                          <div className={`text-xs font-bold ${isPositiveEmissions ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {formatPercentage(mockData.emissions7d)}
                          </div>
                        </div>
                      </div>

                      {/* TAO Inflow with 7d change below */}
                      <div className="col-span-1 flex items-center justify-end">
                        <div className="text-right">
                          <div className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                            {formatTAO(mockData.taoInflow)}
                          </div>
                          <div className={`text-xs font-bold ${isPositiveInflow ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {formatPercentage(mockData.taoInflow7d)}
                          </div>
                        </div>
                      </div>

                      {/* Market Cap */}
                      <div className="col-span-1 flex items-center justify-end">
                        <span className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                          {formatCurrency(subnet.marketCap)}
                        </span>
                      </div>

                      {/* X Followers */}
                      <div className="col-span-1 flex items-center justify-end">
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className={isLightMode ? 'text-slate-400' : 'text-slate-500'} />
                          <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                            {formatNumber(mockData.xFollowers)}
                          </span>
                        </div>
                      </div>

                      {/* 30D Discord Messages */}
                      <div className="col-span-1 flex items-center justify-end">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            <MessageSquare size={12} className={isLightMode ? 'text-slate-400' : 'text-slate-500'} />
                            <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                              {formatNumber(mockData.discordMessages30d)}
                            </span>
                          </div>
                          <span className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            {mockData.daysSinceLastDiscord}d ago
                          </span>
                        </div>
                      </div>

                      {/* 30D Github Commits */}
                      <div className="col-span-1 flex items-center justify-end">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            <GitBranch size={12} className={isLightMode ? 'text-slate-400' : 'text-slate-500'} />
                            <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                              {formatNumber(mockData.githubCommits30d)}
                            </span>
                          </div>
                          <span className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            {mockData.daysSinceLastCommit}d ago
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'miner-flows' && (
            <div className={`rounded-3xl border backdrop-blur-xl overflow-hidden ${
              isLightMode
                ? 'border-slate-200 bg-white/80'
                : 'border-white/5 bg-slate-900/40'
            }`}>
              <div className="overflow-x-auto">
                <div className="min-w-[1800px]">
                  <div className={`${minerFlowsGrid} px-6 py-4 border-b ${
                    isLightMode
                      ? 'bg-slate-100/60 border-slate-200'
                      : 'bg-slate-950/60 border-white/5'
                  }`}>
                    <div className="col-span-1">
                      <SortableHeader label={minerFlowLabel('Rank', minerFlowsInfo.rank, 'rank')} sortKey="rank" />
                    </div>
                    <div className="col-span-1">
                      <SortableHeader label={minerFlowLabel('Subnet', minerFlowsInfo.subnet, 'subnet')} sortKey="name" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('Miners Sales (30d)', minerFlowsInfo.minerSales30d, 'minerSales30d')} sortKey="minerSales30d" align="right" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('Miner Selling Ratio (30d)', minerFlowsInfo.minerSellingRatio30d, 'minerSellingRatio30d')} sortKey="minerSellingRatio30d" align="right" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('% sold after 1d', minerFlowsInfo.percentSold1d, 'percentSold1d')} sortKey="percentSold1d" align="right" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('% sold after 7d', minerFlowsInfo.percentSold7d, 'percentSold7d')} sortKey="percentSold7d" align="right" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('% sold after 14d', minerFlowsInfo.percentSold14d, 'percentSold14d')} sortKey="percentSold14d" align="right" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('% sold > 30d', minerFlowsInfo.percentSoldOver30d, 'percentSoldOver30d')} sortKey="percentSoldOver30d" align="right" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('Average holding time (30d)', minerFlowsInfo.avgHoldingDays30d, 'avgHoldingDays30d')} sortKey="avgHoldingDays30d" align="right" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('Miner Extraction Beta', minerFlowsInfo.minerExtractionBeta, 'minerExtractionBeta')} sortKey="minerExtractionBeta" align="right" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('Miner Dump Response', minerFlowsInfo.minerDumpResponse, 'minerDumpResponse')} sortKey="minerDumpResponse" align="right" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <SortableHeader label={minerFlowLabel('Miner Pump Response', minerFlowsInfo.minerPumpResponse, 'minerPumpResponse')} sortKey="minerPumpResponse" align="right" />
                    </div>
                  </div>

                  <div className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/5'}`}>
                    {sortedSubnets.map((subnet) => {
                      const subnetNumber = subnet.id.replace('SN', '');
                      const mockData = generateMockData(subnet.id);
                      const isDumpPositive = mockData.minerDumpResponse >= 0;
                      const isPumpPositive = mockData.minerPumpResponse >= 0;

                      return (
                        <div
                          key={subnet.id}
                          className={`${minerFlowsGrid} px-6 py-4 transition-colors duration-200 group cursor-pointer ${
                            isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="col-span-1 flex items-center">
                            <span className={`font-mono text-sm ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                              {subnet.rank}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl overflow-hidden border flex-shrink-0 ${
                              isLightMode ? 'border-slate-200 bg-slate-100' : 'border-white/10 bg-slate-800/60'
                            }`}>
                              <img
                                src={`/logos/${subnetNumber}.webp`}
                                alt={subnet.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xs font-bold ${isLightMode ? 'text-slate-400' : 'text-slate-500'}">${subnetNumber}</div>`;
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className={`text-sm font-semibold transition-colors truncate ${
                                isLightMode
                                  ? 'text-slate-900 group-hover:text-teal-600'
                                  : 'text-white group-hover:text-teal-400'
                              }`}>
                                {subnet.name}
                              </div>
                              <div className={`text-xs font-mono ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
                                {subnet.id}
                              </div>
                            </div>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                              {formatMinerFlowValue(mockData.minerSales30d)}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                              {formatPercent(mockData.minerSellingRatio30d)}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                              {formatPercent(mockData.percentSold1d)}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                              {formatPercent(mockData.percentSold7d)}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                              {formatPercent(mockData.percentSold14d)}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                              {formatPercent(mockData.percentSoldOver30d)}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                              {mockData.avgHoldingDays30d.toFixed(1)}d
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                              {mockData.minerExtractionBeta.toFixed(1)}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm font-mono ${isDumpPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {formatSignedPercent(mockData.minerDumpResponse)}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <span className={`text-sm font-mono ${isPumpPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {formatSignedPercent(mockData.minerPumpResponse)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Aggregate Row Overlay - Always visible */}
        <div className="absolute bottom-0 left-0 right-0 z-30">
          {activeTab === 'overview' && aggregates && (
            <div className={`mx-6 mb-6 rounded-2xl border backdrop-blur-xl shadow-2xl ${
              isLightMode
                ? 'bg-slate-50/98 border-slate-300'
                : 'bg-slate-950/98 border-white/10'
            }`}>
              <div className="grid grid-cols-10 gap-4 px-6 py-4">
                <div className="col-span-1 flex items-center">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isLightMode ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    Total
                  </span>
                </div>
                <div className="col-span-2 flex items-center">
                  <span className={`text-sm font-semibold ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                    {aggregates.count} subnets
                  </span>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <div className="text-right">
                    <div className={`text-sm font-mono font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                      {formatTAO(aggregates.avgPrice)}
                    </div>
                    <div className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>avg</div>
                  </div>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <div className="text-right">
                    <div className={`text-sm font-mono font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                      {aggregates.totalEmissions.toFixed(2)}%
                    </div>
                    <div className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>total</div>
                  </div>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <div className="text-right">
                    <div className={`text-sm font-mono font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                      {formatTAO(aggregates.totalTaoInflow)}
                    </div>
                    <div className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>total</div>
                  </div>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <div className="text-right">
                    <div className={`text-sm font-mono font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                      {formatCurrency(aggregates.totalMarketCap)}
                    </div>
                    <div className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>total</div>
                  </div>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <span className={`text-sm font-mono ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                    {formatNumber(aggregates.totalXFollowers)}
                  </span>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <span className={`text-sm font-mono ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                    {formatNumber(aggregates.totalDiscordMessages)}
                  </span>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <span className={`text-sm font-mono ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                    {formatNumber(aggregates.totalGithubCommits)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'miner-flows' && minerFlowsAggregates && (
            <div className={`mx-6 mb-6 rounded-2xl border backdrop-blur-xl shadow-2xl ${
              isLightMode
                ? 'bg-slate-50/98 border-slate-300'
                : 'bg-slate-950/98 border-white/10'
            }`}>
              <div className="overflow-x-auto">
                <div className="min-w-[1800px]">
                  <div className={`${minerFlowsGrid} px-6 py-4`}>
                    <div className="col-span-1 flex items-center">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        isLightMode ? 'text-slate-600' : 'text-slate-400'
                      }`}>
                        Total
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className={`text-sm font-semibold ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                        {minerFlowsAggregates.count} subnets
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm font-mono font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {formatMinerFlowValue(minerFlowsAggregates.totalSales30d)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {formatPercent(minerFlowsAggregates.avgSellingRatio30d)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                        {formatPercent(minerFlowsAggregates.avgPercentSold1d)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                        {formatPercent(minerFlowsAggregates.avgPercentSold7d)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                        {formatPercent(minerFlowsAggregates.avgPercentSold14d)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                        {formatPercent(minerFlowsAggregates.avgPercentSoldOver30d)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {minerFlowsAggregates.avgHoldingDays30d.toFixed(1)}d
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm font-mono ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {minerFlowsAggregates.avgExtractionBeta.toFixed(1)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm font-mono ${
                        minerFlowsAggregates.avgDumpResponse >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {formatSignedPercent(minerFlowsAggregates.avgDumpResponse)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-sm font-mono ${
                        minerFlowsAggregates.avgPumpResponse >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {formatSignedPercent(minerFlowsAggregates.avgPumpResponse)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DatasetsView;
