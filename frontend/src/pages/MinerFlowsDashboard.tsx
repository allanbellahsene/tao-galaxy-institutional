import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Database,
  HelpCircle,
  Home,
  Layers3,
  LineChart,
  Settings,
  ServerCog,
  Shield,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
  Sun,
  Moon
} from 'lucide-react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from 'recharts';
import { useSubnetsData, usePricesData, useEmissionsData } from '../context/DataContext';
import PriceDataService from '../services/PriceDataService';
import { CategoryType, SubnetType } from '../types';
import { MinerFlowsView } from '../components/InstitutionalDashboard/MinerFlowsView';

type PriceSeries = Record<string, Array<{ date: string; value: number }>>;
type EmissionsSeries = Record<
  string,
  Array<{ date: string; tao_emissions: number; usd_emissions?: number }>
>;

const verticalAxisOptions = [
  'Health Index',
  'Sentiment Index',
  'Execution Index',
  'Traction Index',
  'Incentives Index',
  'On-chain Index'
] as const;

const horizontalAxisOptions = ['Market Cap', '% Emissions'] as const;
const displayModeOptions = [
  { value: 'topMarketCap', label: 'Top 40 by Market Cap' },
  { value: 'topChange', label: 'Top 40 by 24h Change' },
  { value: 'all', label: 'Show All' }
] as const;

type VerticalAxis = (typeof verticalAxisOptions)[number];
type HorizontalAxis = (typeof horizontalAxisOptions)[number];
type DisplayMode = (typeof displayModeOptions)[number]['value'];

interface ChartPoint {
  id: string;
  name: string;
  shortLabel: string;
  category: string;
  marketCap: number | null;
  price: number | null;
  priceChange: number | null;
  emissionsPercent: number | null;
  networkFunding: number | null;
  healthScore: number;
  size: number;
  metrics: Record<VerticalAxis, number>;
}

const formatCurrency = (value: number | null | undefined, prefix = '$') => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${prefix}${value.toLocaleString('en-US', {
    maximumFractionDigits: value >= 1000 ? 0 : 2
  })}`;
};

const formatDelta = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const rounded = value >= 10 || value <= -10 ? value.toFixed(1) : value.toFixed(2);
  return `${value > 0 ? '+' : ''}${rounded}%`;
};

const AxisTick: React.FC<{
  x?: number;
  y?: number;
  payload?: { value: number };
  formatter: (value: number) => string;
  isVertical?: boolean;
  isLightMode?: boolean;
}> = ({ x = 0, y = 0, payload, formatter, isVertical = false, isLightMode = false }) => {
  const value = payload?.value ?? 0;
  const label = formatter(value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={isVertical ? 6 : 14}
        x={isVertical ? -8 : 0}
        y={0}
        textAnchor={isVertical ? 'end' : 'middle'}
        className={`text-[13px] font-semibold tracking-[0.01em] ${
          isLightMode ? 'fill-slate-700' : 'fill-slate-100'
        }`}
      >
        {label}
      </text>
    </g>
  );
};

const seededScore = (id: string, metric: string) => {
  const key = `${id}-${metric}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const normalized = (Math.sin(hash) + 1) / 2;
  return Math.round(40 + normalized * 55);
};

const getSubnetNumber = (subnetId: string) => {
  const match = subnetId.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

const CustomDropdown: React.FC<{
  value: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  label?: string;
  icon?: React.ReactNode;
  minimal?: boolean;
  isLightMode?: boolean;
}> = ({ value, options, onChange, label, icon, minimal = false, isLightMode = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = useMemo(() => {
    const selected = options.find(opt => (typeof opt === 'string' ? opt === value : opt.value === value));
    return typeof selected === 'string' ? selected : selected?.label || value;
  }, [value, options]);

  return (
    <div className="relative" ref={dropdownRef}>
      {label && <div className={`text-[10px] uppercase tracking-wider mb-1.5 font-semibold ml-1 ${
        isLightMode ? 'text-slate-600' : 'text-slate-400'
      }`}>{label}</div>}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between gap-3 rounded-xl transition-all duration-300
          ${isLightMode
            ? 'bg-white border border-slate-200 hover:border-teal-500/50 hover:bg-slate-50'
            : 'bg-slate-900/60 border border-slate-700/50 hover:border-teal-500/50 hover:bg-slate-800/80'}
          ${isOpen ? 'ring-2 ring-teal-500/20 border-teal-500/50' : ''}
          ${minimal ? 'p-2.5' : 'px-4 py-2.5 min-w-[180px]'} group
        `}
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className={`transition-colors ${
            isLightMode
              ? 'text-teal-600 group-hover:text-teal-700'
              : 'text-teal-400/80 group-hover:text-teal-300'
          }`}>{icon}</span>}
          {!minimal && <span className={`text-sm font-medium transition-colors ${
            isLightMode
              ? 'text-slate-700 group-hover:text-slate-900'
              : 'text-slate-200 group-hover:text-white'
          }`}>{selectedLabel}</span>}
        </div>
        {!minimal && (
          <ChevronDown
            size={14}
            className={`transition-transform duration-300 ${
              isOpen
                ? 'rotate-180 text-teal-400'
                : isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}
          />
        )}
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-2 w-full min-w-[200px] rounded-xl backdrop-blur-xl border shadow-2xl overflow-hidden animate-slide-up origin-top ${
          minimal ? 'right-0' : ''
        } ${
          isLightMode
            ? 'bg-white/95 border-slate-200 shadow-slate-300/50'
            : 'bg-slate-900/95 border-slate-700/80 shadow-black/50'
        }`}>
          <div className="max-h-[240px] overflow-y-auto scrollbar-thin py-1.5">
            {options.map((option) => {
              const optValue = typeof option === 'string' ? option : option.value;
              const optLabel = typeof option === 'string' ? option : option.label;
              const isSelected = optValue === value;

              return (
                <button
                  key={optValue}
                  onClick={() => {
                    onChange(optValue);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full text-left px-4 py-2.5 text-sm transition-all duration-200 flex items-center justify-between border-l-2
                    ${isSelected
                      ? isLightMode
                        ? 'bg-teal-500/10 text-teal-700 border-teal-500'
                        : 'bg-teal-500/10 text-teal-300 border-teal-500'
                      : isLightMode
                        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'}
                  `}
                >
                  {optLabel}
                  {isSelected && <Sparkles size={12} className="text-teal-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const SidebarNav: React.FC<{
  collapsed: boolean;
  onToggle: () => void;
  isLightMode: boolean;
  onThemeToggle: () => void;
  activeItem: string;
  setActiveItem: (item: string) => void;
}> = ({ collapsed, onToggle, isLightMode, onThemeToggle, activeItem, setActiveItem }) => {

  const sections = [
    {
      title: 'Intelligence',
      items: [
        { label: 'Home', icon: <Home size={18} /> },
        { label: 'Subnets', icon: <Layers3 size={18} /> },
        { label: 'Compare', icon: <LineChart size={18} /> },
        { label: 'Insights', icon: <Zap size={18} /> },
        { label: 'Miner Flows', icon: <Activity size={18} /> },
      ]
    },
    {
      title: 'Portfolio',
      items: [
        { label: 'Holdings', icon: <Wallet size={18} /> },
        { label: 'Staking', icon: <TrendingUp size={18} /> },
        { label: 'Alerts', icon: <Bell size={18} /> },
      ]
    },
    {
      title: 'System',
      items: [
        { label: 'API Access', icon: <ServerCog size={18} /> },
        { label: 'Settings', icon: <Settings size={18} /> },
        { label: 'Support', icon: <HelpCircle size={18} /> }
      ]
    }
  ];

  return (
    <aside
      className={`
        relative hidden md:flex flex-col z-40 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
        ${collapsed ? 'w-24' : 'w-72'}
        ${isLightMode
          ? 'bg-white/95 backdrop-blur-2xl border-r border-slate-200'
          : 'bg-slate-950/40 backdrop-blur-2xl border-r border-white/5'}
      `}
    >
      <div className="flex items-center justify-between px-6 py-8">
        <div className={`flex items-center gap-3 transition-opacity duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
            <LineChart size={22} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-teal-400 font-bold">TAO Galaxy</div>
            <div className={`text-xl font-bold tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Institutional</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`
            p-2 rounded-xl transition-all
            ${collapsed ? 'mx-auto' : ''}
            ${isLightMode
              ? 'border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              : 'border border-white/5 text-slate-400 hover:text-white hover:bg-white/5'}
          `}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-thin">
        {sections.map(section => (
          <div key={section.title} className="space-y-2">
            {!collapsed && (
              <p className={`text-[10px] uppercase tracking-[0.2em] px-4 font-bold mb-3 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map(item => {
                const active = activeItem === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveItem(item.label)}
                    className={`
                      group flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all duration-300 relative overflow-hidden
                      ${active
                        ? isLightMode ? 'text-slate-900' : 'text-white'
                        : isLightMode ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}
                    `}
                  >
                    {active && (
                      <div className={`absolute inset-0 bg-gradient-to-r rounded-xl ${
                        isLightMode
                          ? 'from-teal-500/5 to-indigo-500/5 border border-teal-500/20'
                          : 'from-teal-500/10 to-indigo-500/5 border border-teal-500/20'
                      }`} />
                    )}

                    <span className={`
                      relative z-10 p-2 rounded-lg transition-all duration-300
                      ${active
                        ? 'bg-gradient-to-br from-teal-500 to-indigo-600 text-white shadow-lg shadow-teal-500/25'
                        : isLightMode
                          ? 'bg-slate-100 group-hover:bg-slate-200 text-slate-600 group-hover:text-slate-900'
                          : 'bg-slate-900/50 group-hover:bg-slate-800 text-slate-400 group-hover:text-white'}
                    `}>
                      {item.icon}
                    </span>

                    {!collapsed && (
                      <span className="relative z-10 text-sm font-medium tracking-wide">
                        {item.label}
                      </span>
                    )}

                    {active && !collapsed && (
                      <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`p-6 border-t ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
        {/* Theme Toggle Button */}
        <button
          onClick={onThemeToggle}
          className={`
            w-full mb-4 flex items-center justify-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
            ${isLightMode
              ? 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700'
              : 'bg-slate-900/60 hover:bg-slate-800/60 border border-white/10 text-slate-300'}
            ${collapsed ? 'hidden' : 'flex'}
          `}
        >
          {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
          {!collapsed && (
            <span className="text-sm font-semibold">
              {isLightMode ? 'Dark Mode' : 'Light Mode'}
            </span>
          )}
        </button>

        <div className={`
          rounded-2xl border p-4
          ${collapsed ? 'hidden' : 'block'}
          ${isLightMode
            ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200'
            : 'bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border-indigo-500/20'}
        `}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${isLightMode ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-300'}`}>
              <Shield size={18} />
            </div>
            <div>
              <div className={`text-sm font-bold mb-0.5 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Private Beta</div>
              <div className={`text-xs leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-indigo-200/70'}`}>
                You are viewing the institutional preview build v2.4.0
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  delta?: number | null;
  deltaIsPercent?: boolean;
  isLightMode?: boolean;
}> = ({ label, value, delta, deltaIsPercent = true, isLightMode = false }) => {
  const positive = delta !== undefined && delta !== null && delta >= 0;
  const negative = delta !== undefined && delta !== null && delta < 0;

  const deltaLabel =
    delta === undefined || delta === null
      ? null
      : deltaIsPercent
        ? formatDelta(delta)
        : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
      isLightMode
        ? 'border-slate-200 bg-white/80 backdrop-blur-md hover:bg-white hover:border-slate-300 hover:shadow-xl'
        : 'border-white/5 bg-slate-900/40 backdrop-blur-md hover:bg-slate-800/40 hover:border-white/10 hover:shadow-2xl hover:shadow-teal-500/5'
    }`}>
      <div className={`absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

      <div className="relative flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${
            isLightMode ? 'text-slate-600' : 'text-slate-400'
          }`}>{label}</span>
          {delta !== undefined && delta !== null && (
            <div className={`
              flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full
              ${positive ? 'bg-emerald-500/10 text-emerald-400' : negative ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-500/10 text-slate-400'}
            `}>
              {positive ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
              {deltaLabel}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-2xl md:text-3xl font-bold tracking-tight ${
            isLightMode ? 'text-slate-900' : 'text-white text-glow-blue'
          }`}>{value}</span>
        </div>
      </div>
    </div>
  );
};

const BubbleTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  xFormatter: (value: number) => string;
  yFormatter: (value: number) => string;
  verticalLabel: string;
  horizontalLabel: string;
  isLightMode?: boolean;
}> = ({ active, payload, xFormatter, yFormatter, verticalLabel, horizontalLabel, isLightMode = false }) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload as ChartPoint & { x: number; y: number };

  return (
    <div className={`backdrop-blur-xl border rounded-2xl shadow-2xl p-5 min-w-[280px] animate-fade-in ring-1 ${
      isLightMode
        ? 'bg-white/95 border-teal-500/40 shadow-slate-400/50 ring-slate-200/50'
        : 'bg-slate-950/90 border-teal-500/30 shadow-black/50 ring-white/5'
    }`}>
      <div className={`flex items-center justify-between mb-4 pb-3 border-b ${
        isLightMode ? 'border-slate-200' : 'border-white/10'
      }`}>
        <div>
          <div className={`text-lg font-bold tracking-tight ${
            isLightMode ? 'text-slate-900' : 'text-white'
          }`}>{point.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
              isLightMode
                ? 'bg-slate-100 text-slate-700'
                : 'bg-white/10 text-slate-300'
            }`}>
              SN{point.shortLabel}
            </span>
            <span className={`text-xs font-medium ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>{point.category}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs uppercase tracking-wider font-bold mb-0.5 ${
            isLightMode ? 'text-slate-500' : 'text-slate-500'
          }`}>Price</div>
          <div className={`text-lg font-mono font-bold ${
            isLightMode ? 'text-slate-900' : 'text-white'
          }`}>
            {point.price ? formatCurrency(point.price) : '—'}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl p-3 border ${
            isLightMode
              ? 'bg-slate-50 border-slate-200'
              : 'bg-slate-900/50 border-white/5'
          }`}>
            <div className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${
              isLightMode ? 'text-slate-600' : 'text-slate-500'
            }`}>24h Change</div>
            <div
              className={`text-sm font-bold ${point.priceChange === null || point.priceChange === undefined
                ? isLightMode ? 'text-slate-700' : 'text-slate-300'
                : point.priceChange >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
                }`}
            >
              {formatDelta(point.priceChange)}
            </div>
          </div>
          <div className={`rounded-xl p-3 border ${
            isLightMode
              ? 'bg-slate-50 border-slate-200'
              : 'bg-slate-900/50 border-white/5'
          }`}>
            <div className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${
              isLightMode ? 'text-slate-600' : 'text-slate-500'
            }`}>Health</div>
            <div className="text-sm font-bold text-teal-400">{point.healthScore}/100</div>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-center text-sm">
            <span className={`font-medium ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>{horizontalLabel}</span>
            <span className={`font-mono font-bold ${
              isLightMode ? 'text-slate-900' : 'text-white'
            }`}>{xFormatter(point.x)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className={`font-medium ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>{verticalLabel}</span>
            <span className={`font-mono font-bold ${
              isLightMode ? 'text-slate-900' : 'text-white'
            }`}>{yFormatter(point.y)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className={`font-medium ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>Daily Funding</span>
            <span className={`font-mono font-bold ${
              isLightMode ? 'text-slate-700' : 'text-slate-200'
            }`}>
              {point.networkFunding ? formatCurrency(point.networkFunding) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const BubbleDot = (props: any) => {
  const { cx, cy, size, payload, isLightMode } = props;
  const radius = Math.max(12, Math.sqrt(size) * 1.8); // Slightly larger
  const glowRadius = radius + 15;
  const deltaLabel =
    payload.priceChange === null || payload.priceChange === undefined
      ? '—'
      : formatDelta(payload.priceChange);
  const deltaPositive = payload.priceChange !== null && payload.priceChange !== undefined && payload.priceChange >= 0;

  // Dynamic colors based on performance
  const mainColor = deltaPositive ? '#34d399' : '#fb7185'; // Emerald-400 : Rose-400
  const glowColor = deltaPositive ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 113, 133, 0.3)';
  const fillColor = isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)';
  const textColor = isLightMode ? '#0f172a' : '#ffffff';

  return (
    <g className="cursor-pointer transition-all duration-300 hover:opacity-100">
      {/* Outer Glow */}
      <circle cx={cx} cy={cy} r={glowRadius} fill={glowColor} className="animate-pulse-glow" style={{ filter: 'blur(8px)' }} />

      {/* Inner Glow */}
      <circle cx={cx} cy={cy} r={radius + 4} fill={mainColor} fillOpacity={0.2} />

      {/* Core Bubble */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fillColor}
        stroke={mainColor}
        strokeWidth={2}
        className="transition-all duration-300 ease-out hover:stroke-[3px]"
      />

      {/* Label */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dy={-2}
        fill={textColor}
        className="text-[11px] font-bold pointer-events-none tracking-tight"
        style={{ textShadow: isLightMode ? '0 1px 2px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.8)' }}
      >
        SN{payload.shortLabel}
      </text>

      {/* Delta Label */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dy={14}
        className={`text-[10px] font-bold pointer-events-none ${deltaPositive ? 'fill-emerald-400' : 'fill-rose-400'}`}
        style={{ textShadow: isLightMode ? '0 1px 2px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.8)' }}
      >
        {deltaLabel}
      </text>
    </g>
  );
};

const getAxisValue = (point: ChartPoint, axis: VerticalAxis | HorizontalAxis) => {
  switch (axis) {
    case 'Market Cap':
      return point.marketCap;
    case '% Emissions':
      return point.emissionsPercent;
    default:
      return point.metrics[axis as VerticalAxis];
  }
};

const valueFormatter = (axis: VerticalAxis | HorizontalAxis) => {
  if (axis === 'Market Cap') {
    return (value: number) => formatCurrency(value);
  }
  if (axis === '% Emissions') {
    return (value: number) => `${value.toFixed(2)}%`;
  }
  return (value: number) => `${value.toFixed(0)}`;
};

// ============================================================================
// MOMENTUM SECTION COMPONENT
// ============================================================================

type TimeframeOption = '24h' | '7d' | '30d' | '90d' | 'All';

const CATEGORY_METRICS = {
  Technical: ['Price', 'Volume', 'Volatility-Adjusted Return'],
  Social: ['X Followers', 'Discord Active Users', 'Website Traffic'],
  'On-Chain': ['% Emissions', 'TAO Emissions', 'TAO Net Inflows'],
  Development: ['GitHub Commits', 'Lines of Code Changed'],
  Sentiment: ['Discord Sentiment', 'X Sentiment', 'Aggregate Sentiment']
} as const;

type CategoryName = keyof typeof CATEGORY_METRICS;

interface SubnetMomentumData {
  subnetId: string;
  subnetNumber: number;
  subnetName: string;
  value: number;
  displayValue: string;
}

interface MomentumSectionProps {
  title: string;
  type: 'gaining' | 'losing';
  subnets: Array<SubnetType & { categoryName?: string }>;
  isLightMode?: boolean;
}

// Mock data generator
const generateMockMomentumData = (
  _category: CategoryName,
  metric: string,
  type: 'gaining' | 'losing',
  subnets: Array<SubnetType & { categoryName?: string }>
): SubnetMomentumData[] => {
  // Filter to only subnets with valid IDs and shuffle
  const validSubnets = subnets.filter(s => s.id && s.id.match(/^SN\d+$/i));
  const shuffled = [...validSubnets].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, 5).map((subnet, idx) => {
    const subnetNumber = parseInt(subnet.id.replace(/\D/g, ''), 10);
    const baseValue = type === 'gaining'
      ? 15 - idx * 2 - Math.random() * 2
      : -(15 - idx * 2 - Math.random() * 2);

    let displayValue: string;
    if (metric.includes('%') || metric.includes('Price') || metric.includes('Sentiment')) {
      displayValue = `${baseValue > 0 ? '+' : ''}${baseValue.toFixed(1)}%`;
    } else if (metric.includes('Emissions') && !metric.includes('%')) {
      displayValue = `${baseValue > 0 ? '+' : ''}${Math.abs(baseValue * 100).toFixed(0)} τ`;
    } else {
      displayValue = `${baseValue > 0 ? '+' : ''}${Math.abs(baseValue * 10).toFixed(0)}`;
    }

    return {
      subnetId: subnet.id,
      subnetNumber,
      subnetName: subnet.name || `Subnet ${subnetNumber}`,
      value: baseValue,
      displayValue
    };
  });
};

const MomentumCategoryColumn: React.FC<{
  category: CategoryName;
  type: 'gaining' | 'losing';
  timeframe: TimeframeOption;
  subnets: Array<SubnetType & { categoryName?: string }>;
  isLightMode?: boolean;
}> = ({ category, type, timeframe, subnets, isLightMode = false }) => {
  const metrics = CATEGORY_METRICS[category];
  const [selectedMetric, setSelectedMetric] = useState<string>(metrics[0]);
  const data = useMemo(
    () => generateMockMomentumData(category, selectedMetric, type, subnets),
    [category, selectedMetric, type, timeframe, subnets]
  );

  const accentColor = type === 'gaining' ? 'teal' : 'rose';

  return (
    <div className={`flex-1 min-w-[220px] rounded-3xl border backdrop-blur-xl p-6 shadow-xl transition-all duration-300 group ${
      isLightMode
        ? 'border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-slate-300/30 hover:border-slate-300'
        : 'border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/40 shadow-black/30 hover:border-white/20'
    }`}>
      {/* Soft inner glow */}
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
        isLightMode ? 'from-teal-500/5' : 'from-white/5'
      }`} />

      <div className="relative">
        {/* Category Title - Fixed height for alignment */}
        <div className={`text-[11px] uppercase tracking-[0.2em] font-bold mb-3 h-4 ${
          isLightMode ? 'text-slate-700' : 'text-slate-300'
        }`}>
          {category}
        </div>

        {/* Horizontal Chip Selector with scroll overflow */}
        <div className={`relative mb-6 pb-3 border-b ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
            {metrics.map((metric) => {
              const isActive = selectedMetric === metric;
              return (
                <button
                  key={metric}
                  type="button"
                  onClick={() => setSelectedMetric(metric)}
                  className={`relative shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors duration-200 ${
                    isActive
                      ? isLightMode
                        ? 'font-semibold text-slate-900 bg-slate-200 shadow-inner'
                        : 'font-semibold text-white bg-white/10 shadow-inner'
                      : isLightMode
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white/80'
                  }`}
                  title={metric}
                >
                  <span className="block truncate">{metric}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subnet Rows - Increased spacing */}
        <div className="space-y-3">
          {data.map((item) => (
            <button
              key={item.subnetId}
              type="button"
              onClick={() => console.log(`Navigate to ${item.subnetId}`)}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all duration-200 group/row shadow-inner ${
                isLightMode
                  ? 'bg-slate-50/50 hover:bg-white border-transparent hover:border-slate-200'
                  : 'bg-slate-950/50 hover:bg-slate-800/70 border-transparent hover:border-white/10'
              }`}
            >
              {/* Subnet Logo */}
              <div className={`flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden border shadow-md ${
                isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/60 border-white/10'
              }`}>
                <img
                  src={`/logos/${item.subnetNumber}.webp`}
                  alt={item.subnetName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xs font-bold ${isLightMode ? 'text-slate-600' : 'text-slate-500'}">${item.subnetNumber}</div>`;
                  }}
                />
              </div>

              {/* Subnet Info */}
              <div className="flex-1 min-w-0 text-left">
                <div className={`text-sm font-semibold transition-colors truncate ${
                  isLightMode
                    ? 'text-slate-700 group-hover/row:text-slate-900'
                    : 'text-slate-100 group-hover/row:text-white'
                }`}>
                  {item.subnetName}
                </div>
                <div className={`text-xs font-medium ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  #{item.subnetNumber}
                </div>
              </div>

              {/* Delta with Directional Icon */}
              <div className={`flex-shrink-0 flex items-center gap-1.5 text-sm font-bold text-${accentColor}-400`}>
                {type === 'gaining' ? (
                  <TrendingUp size={14} className="flex-shrink-0" />
                ) : (
                  <TrendingUp size={14} className="flex-shrink-0 rotate-180" />
                )}
                <span>{item.displayValue}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const MomentumSection: React.FC<MomentumSectionProps> = ({ title, type, subnets, isLightMode = false }) => {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('24h');
  const categories: CategoryName[] = ['Technical', 'Social', 'On-Chain', 'Development', 'Sentiment'];
  const accentColor = type === 'gaining' ? 'teal' : 'rose';
  const gradientFrom = type === 'gaining' ? 'from-teal-500/10' : 'from-rose-500/10';
  const gradientTo = type === 'gaining' ? 'to-emerald-500/5' : 'to-red-500/5';

  return (
    <div className={`rounded-3xl border backdrop-blur-xl shadow-2xl overflow-hidden ${
      isLightMode
        ? 'border-slate-200 bg-white/80 shadow-slate-300/20'
        : 'border-white/5 bg-slate-900/40 shadow-black/20'
    }`}>
      {/* Strong Header Band */}
      <div className={`relative bg-gradient-to-r ${gradientFrom} ${gradientTo} border-b px-8 py-6 backdrop-blur-sm ${
        isLightMode ? 'border-slate-200' : 'border-white/5'
      }`}>
        <div className={`absolute inset-0 bg-gradient-to-b to-transparent ${
          isLightMode ? 'from-white/30' : 'from-white/5'
        }`} />

        <div className="relative flex items-center justify-between">
          {/* Left: Bullet + Title */}
          <div className="flex items-center gap-4">
            <div className={`h-3 w-3 rounded-full bg-${accentColor}-400 shadow-lg shadow-${accentColor}-500/50 animate-pulse`} />
            <h2 className={`text-2xl font-bold tracking-tight ${
              isLightMode ? 'text-slate-900' : 'text-white'
            }`}>
              {title}
            </h2>
          </div>

          {/* Right: Timeframe Selector */}
          <div className="flex items-center gap-3">
            <span className={`text-xs uppercase tracking-wider font-semibold ${
              isLightMode ? 'text-slate-700' : 'text-slate-300'
            }`}>Timeframe</span>
            <div className={`flex items-center gap-1.5 p-1.5 rounded-xl border backdrop-blur-sm ${
              isLightMode
                ? 'bg-white border-slate-200'
                : 'bg-slate-950/60 border-white/10'
            }`}>
              {(['24h', '7d', '30d', '90d', 'All'] as TimeframeOption[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                    timeframe === tf
                      ? `bg-${accentColor}-500/30 text-${accentColor}-200 shadow-lg shadow-${accentColor}-500/20 border border-${accentColor}-400/30`
                      : isLightMode
                        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Category Columns */}
      <div className="flex gap-5 overflow-x-auto scrollbar-thin p-8">
        {categories.map((category) => (
          <MomentumCategoryColumn
            key={category}
            category={category}
            type={type}
            timeframe={timeframe}
            subnets={subnets}
            isLightMode={isLightMode}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

const InstitutionalDashboard: React.FC = () => {
  const { data: subnetsData, loading: subnetsLoading } = useSubnetsData();
  const { data: pricesData, loading: pricesLoading } = usePricesData();
  const { data: emissionsData, loading: emissionsLoading } = useEmissionsData();
  const priceService = useMemo(() => PriceDataService.getInstance(), []);

  const [verticalAxis, setVerticalAxis] = useState<VerticalAxis>('Health Index');
  const [horizontalAxis, setHorizontalAxis] = useState<HorizontalAxis>('Market Cap');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('topMarketCap');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [activeView, setActiveView] = useState('Home');

  const flattenSubnets = useMemo(() => {
    if (!subnetsData) return [] as Array<SubnetType & { categoryName?: string }>;
    return subnetsData.flatMap((category: CategoryType) =>
      category.subnets.map(subnet => ({
        ...subnet,
        categoryName: category.name
      }))
    );
  }, [subnetsData]);

  const emissionsSnapshot = useMemo(() => {
    const snapshot: {
      totalTAO: number;
      totalUSD: number;
      map: Record<number, { tao_emissions: number; usd_emissions?: number }>;
    } = {
      totalTAO: 0,
      totalUSD: 0,
      map: {}
    };
    if (!emissionsData) return snapshot;

    Object.entries(emissionsData as EmissionsSeries).forEach(([id, points]) => {
      if (!points?.length) return;
      const last = points[points.length - 1];
      const numericId = parseInt(id, 10);
      if (!Number.isNaN(numericId)) {
        snapshot.map[numericId] = {
          tao_emissions: last.tao_emissions,
          usd_emissions: last.usd_emissions
        };
        snapshot.totalTAO += last.tao_emissions || 0;
        snapshot.totalUSD += last.usd_emissions || 0;
      }
    });

    return snapshot;
  }, [emissionsData]);

  const taoPrice = useMemo(
    () => priceService.getCurrentPrice(pricesData as PriceSeries, 'TAO'),
    [priceService, pricesData]
  );
  const taoDelta = useMemo(
    () => priceService.getPriceChange(pricesData as PriceSeries, 'TAO', 1),
    [priceService, pricesData]
  );

  const subnetPriceSummary = useMemo(() => {
    if (!pricesData) return null;
    let latestTotal = 0;
    let previousTotal = 0;

    Object.entries(pricesData as PriceSeries).forEach(([key, series]) => {
      if (key === 'TAO') return;
      if (!series?.length) return;
      const sorted = [...series].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const last = sorted[sorted.length - 1];
      const prev = sorted[Math.max(0, sorted.length - 2)];
      latestTotal += last.value || 0;
      previousTotal += prev.value || 0;
    });

    const delta =
      previousTotal > 0 ? ((latestTotal - previousTotal) / previousTotal) * 100 : null;

    return { latestTotal, delta };
  }, [pricesData]);

  const chartPoints = useMemo(() => {
    if (!flattenSubnets.length) return [] as Array<ChartPoint & { x: number; y: number; fill: string }>;

    const basePoints: ChartPoint[] = flattenSubnets.map(subnet => {
      const price = priceService.getCurrentPrice(pricesData as PriceSeries, subnet.id) ?? subnet.price ?? null;
      const priceChange =
        priceService.getPriceChange(pricesData as PriceSeries, subnet.id, 1) ??
        subnet.priceChange1Day ??
        null;

      const subnetNumber = getSubnetNumber(subnet.id);
      const emissions = subnetNumber !== null ? emissionsSnapshot.map[subnetNumber] : undefined;
      const emissionsPercent =
        emissionsSnapshot.totalTAO > 0 && emissions?.tao_emissions
          ? (emissions.tao_emissions / emissionsSnapshot.totalTAO) * 100
          : null;
      const funding = emissions?.usd_emissions ?? null;
      const marketCap = subnet.marketCap ?? null;
      const changeMagnitude = Math.abs(priceChange ?? 0);

      const metrics = verticalAxisOptions.reduce((acc, metric) => {
        acc[metric] = seededScore(subnet.id, metric);
        return acc;
      }, {} as Record<VerticalAxis, number>);

      const normalizedSize = Math.max(20, Math.min(400, changeMagnitude * 120));

      return {
        id: subnet.id,
        name: subnet.name,
        shortLabel: subnet.id.replace('SN', ''),
        category: subnet.categoryName || subnet.category || 'Subnet',
        marketCap,
        price,
        priceChange,
        emissionsPercent,
        networkFunding: funding,
        healthScore: seededScore(subnet.id, 'health'),
        size: normalizedSize,
        metrics
      };
    });

    let filtered = [...basePoints];

    if (displayMode === 'topMarketCap') {
      filtered = filtered
        .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
        .slice(0, 20);
    } else if (displayMode === 'topChange') {
      filtered = filtered
        .sort(
          (a, b) =>
            Math.abs(b.priceChange ?? 0) - Math.abs(a.priceChange ?? 0)
        )
        .slice(0, 20);
    }

    return filtered
      .map(point => {
        const x = getAxisValue(point, horizontalAxis);
        const y = getAxisValue(point, verticalAxis);
        if (x === null || x === undefined || y === null || y === undefined) return null;

        const fill =
          point.priceChange === null || point.priceChange === undefined
            ? 'rgba(94, 234, 212, 0.75)'
            : point.priceChange >= 0
              ? 'rgba(52, 211, 153, 0.78)'
              : 'rgba(244, 114, 182, 0.78)';

        return { ...point, x, y, fill };
      })
      .filter(Boolean) as Array<ChartPoint & { x: number; y: number; fill: string }>;
  }, [flattenSubnets, priceService, pricesData, emissionsSnapshot, horizontalAxis, verticalAxis, displayMode]);

  const isLoading = subnetsLoading || pricesLoading || emissionsLoading;

  const xFormatter = useMemo(() => valueFormatter(horizontalAxis), [horizontalAxis]);
  const yFormatter = useMemo(() => valueFormatter(verticalAxis), [verticalAxis]);
  const horizontalLabelText =
    horizontalAxis === 'Market Cap' ? 'Market Cap (USD)' : '% Emissions';
  const verticalLabelText = `${verticalAxis} (0-100)`;





  const initialDomains = useMemo(() => {
    if (!chartPoints.length) return null;
    const xVals = chartPoints.map(p => p.x);
    const maxX = Math.max(...xVals);
    // Pad X slightly at the top end so the rightmost bubble isn't cut off
    const padX = maxX * 0.15;

    return {
      x: [0, maxX + padX] as [number, number],
      y: [-10, 110] as [number, number] // Add padding for bubbles, ticks will be 0-100
    };
  }, [chartPoints]);

  // Zoom logic removed as per user request for fixed axes

  const fundingSummary = useMemo(() => {
    if (!emissionsData) return null;
    let latest = 0;
    let previous = 0;

    Object.values(emissionsData as EmissionsSeries).forEach(series => {
      if (!series?.length) return;
      const sorted = [...series].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const last = sorted[sorted.length - 1];
      const prev = sorted[Math.max(0, sorted.length - 2)];
      latest += last.usd_emissions || 0;
      previous += prev.usd_emissions || 0;
    });

    const delta = previous > 0 ? ((latest - previous) / previous) * 100 : null;
    return { latest, delta };
  }, [emissionsData]);

  return (
    <div className={`min-h-screen flex overflow-hidden font-sans transition-colors duration-300 ${
      isLightMode
        ? 'bg-slate-50 text-slate-900 selection:bg-teal-500/20'
        : 'bg-[#020617] text-white selection:bg-teal-500/30'
    }`}>
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

      <SidebarNav
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(s => !s)}
        isLightMode={isLightMode}
        onThemeToggle={() => setIsLightMode(m => !m)}
        activeItem={activeView}
        setActiveItem={setActiveView}
      />

      <div className="flex-1 flex flex-col relative z-10 h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-thin">

          {activeView === 'Home' && (
          <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="TAO Price"
              value={taoPrice ? formatCurrency(taoPrice) : '—'}
              delta={taoDelta}
              isLightMode={isLightMode}
            />
            <MetricCard
              label="Total Subnet Price"
              value="τ1.05"
              delta={subnetPriceSummary?.delta ?? null}
              isLightMode={isLightMode}
            />
            <MetricCard
              label="TAO Galaxy Health Index"
              value="0.72"
              delta={0.06}
              deltaIsPercent={false}
              isLightMode={isLightMode}
            />
            <MetricCard
              label="24h Network Funding"
              value={
                fundingSummary?.latest !== undefined && fundingSummary?.latest !== null
                  ? formatCurrency(fundingSummary.latest)
                  : formatCurrency(emissionsSnapshot.totalUSD || 0)
              }
              delta={fundingSummary?.delta ?? null}
              isLightMode={isLightMode}
            />
          </div>

          {/* Content Area: Chart + Insights */}
          <div className="flex flex-col lg:flex-row gap-6 h-[700px]">
            {/* Main Chart Section (70%) */}
            <div className={`lg:w-[70%] rounded-3xl border backdrop-blur-xl p-6 shadow-2xl flex flex-col h-full ${
              isLightMode
                ? 'border-slate-200 bg-white/80 shadow-slate-300/20'
                : 'border-white/5 bg-slate-900/40 shadow-black/20'
            }`}>
              <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <h2 className={`text-2xl md:text-3xl font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Subnets Map</h2>
                    <p className={`text-sm ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                      Compare subnet fundamentals with market valuation
                    </p>
                  </div>

                  <CustomDropdown
                    value={displayMode}
                    options={displayModeOptions}
                    onChange={(val) => setDisplayMode(val as DisplayMode)}
                    label="Filter"
                    icon={<Settings size={14} />}
                    minimal={true}
                    isLightMode={isLightMode}
                  />
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex flex-col gap-2">
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${
                      isLightMode ? 'text-slate-600' : 'text-slate-400'
                    }`}>Y-Axis</span>
                    <CustomDropdown
                      value={verticalAxis}
                      options={verticalAxisOptions}
                      onChange={(val) => setVerticalAxis(val as VerticalAxis)}
                      icon={<TrendingUp size={14} />}
                      isLightMode={isLightMode}
                    />
                  </div>

                  <div className={`h-10 w-px ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`} />

                  <div className="flex flex-col gap-2">
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${
                      isLightMode ? 'text-slate-600' : 'text-slate-400'
                    }`}>X-Axis</span>
                    <CustomDropdown
                      value={horizontalAxis}
                      options={horizontalAxisOptions}
                      onChange={(val) => setHorizontalAxis(val as HorizontalAxis)}
                      icon={<Activity size={14} />}
                      isLightMode={isLightMode}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full min-h-0 relative">
                <div
                  className={`w-full h-full rounded-2xl border backdrop-blur-sm overflow-hidden relative ${
                    isLightMode
                      ? 'border-slate-200 bg-slate-50/50'
                      : 'border-white/5 bg-slate-950/50'
                  }`}
                >
                  {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-teal-500/30 border-t-teal-500 animate-spin" />
                        <div className="text-sm font-medium text-teal-500/80 animate-pulse">Loading Intelligence...</div>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 30, bottom: 20, left: 10 }}
                        data={chartPoints}
                      >
                        <defs>
                          <linearGradient id="axisGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="rgba(148,163,184,0.1)" />
                            <stop offset="100%" stopColor="rgba(94,234,212,0.2)" />
                          </linearGradient>
                          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'} vertical={false} />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name={horizontalAxis}
                          domain={initialDomains?.x || [0, 'auto']}
                          tick={props => <AxisTick {...props} formatter={xFormatter} isLightMode={isLightMode} />}
                          tickMargin={16}
                          tickFormatter={xFormatter}
                          allowDecimals={false}
                          axisLine={{ stroke: 'url(#axisGradient)', strokeWidth: 1 }}
                          tickLine={false}
                          label={{
                            value: horizontalLabelText,
                            position: 'insideBottomRight',
                            offset: -10,
                            fill: isLightMode ? '#475569' : '#64748b',
                            fontSize: 12,
                            fontWeight: 600,
                            letterSpacing: '0.05em'
                          }}
                          height={60}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          name={verticalAxis}
                          domain={initialDomains?.y || [-10, 110]}
                          ticks={[0, 25, 50, 75, 100]}
                          tick={props => <AxisTick {...props} formatter={yFormatter} isVertical isLightMode={isLightMode} />}
                          tickMargin={16}
                          tickFormatter={yFormatter}
                          axisLine={{ stroke: 'url(#axisGradient)', strokeWidth: 1 }}
                          tickLine={false}
                          label={{
                            value: verticalLabelText,
                            angle: -90,
                            position: 'insideLeft',
                            offset: 20,
                            dy: 40,
                            fill: isLightMode ? '#475569' : '#64748b',
                            fontSize: 12,
                            fontWeight: 600,
                            letterSpacing: '0.05em'
                          }}
                          width={80}
                        />
                        <ZAxis type="number" dataKey="size" range={[100, 800]} />
                        <Tooltip
                          content={
                            <BubbleTooltip
                              xFormatter={val => xFormatter(Number(val))}
                              yFormatter={val => yFormatter(Number(val))}
                              verticalLabel={verticalAxis}
                              horizontalLabel={horizontalAxis}
                              isLightMode={isLightMode}
                            />
                          }
                          cursor={{ stroke: 'rgba(94,234,212,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }}
                          wrapperStyle={{ outline: 'none' }}
                        />
                        <Scatter data={chartPoints} shape={(props: any) => <BubbleDot {...props} isLightMode={isLightMode} />} isAnimationActive={true} animationDuration={1000} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Insights Box Placeholder (30%) */}
            <div className={`lg:w-[30%] rounded-3xl border backdrop-blur-xl p-6 shadow-2xl flex flex-col h-full relative overflow-hidden group ${
              isLightMode
                ? 'border-slate-200 bg-white/80 shadow-slate-300/20'
                : 'border-white/5 bg-slate-900/40 shadow-black/20'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="flex items-center mb-6 relative z-10">
                <h3 className={`text-lg font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Market Intelligence</h3>
              </div>

              <div className={`flex-1 relative z-10 flex items-center justify-center border-2 border-dashed rounded-2xl ${
                isLightMode
                  ? 'border-slate-200 bg-slate-50/30'
                  : 'border-white/5 bg-slate-950/30'
              }`}>
                <div className="text-center p-6">
                  <div className={`text-sm mb-2 ${isLightMode ? 'text-slate-600' : 'text-slate-500'}`}>AI Analysis Module</div>
                  <div className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Coming Soon</div>
                </div>
              </div>
            </div>
          </div>

          {/* Gaining Momentum Section */}
          <MomentumSection title="Gaining Momentum" type="gaining" subnets={flattenSubnets} isLightMode={isLightMode} />

          {/* Losing Momentum Section */}
          <MomentumSection title="Losing Momentum" type="losing" subnets={flattenSubnets} isLightMode={isLightMode} />
          </>
          )}

          {activeView === 'Miner Flows' && (
            <MinerFlowsView isLightMode={isLightMode} />
          )}
        </main >
      </div >
    </div >
  );
};

export default InstitutionalDashboard;
