# Miner Flows & Datasets - Standalone Repository Migration Guide

## Purpose
Create a standalone repository containing ONLY the Miner Flows and Datasets UI features with mock data. This serves as a UI specification for backend developers to understand what data structures they need to provide.

## What This Repo Contains

### 1. Two Main UI Features
- **Datasets View** (`/datasets`) - Comprehensive subnet data table with multiple tabs
- **Miner Flows Dashboard** (`/`) - Miner behavior analytics and visualizations

### 2. Data Structure
- **Real Data**: Subnet identities only (ID, name, logo)
- **Mock Data**: Everything else (prices, emissions, miner flows, social metrics, etc.)

---

## Files to Copy

### Frontend Core Files

#### Pages (2 files)
```
frontend/src/pages/DatasetsView.tsx          → Copy as-is
frontend/src/pages/InstitutionalDashboard.tsx → Copy and rename to MinerFlowsDashboard.tsx
```

#### Components (1 file)
```
frontend/src/components/InstitutionalDashboard/MinerFlowsView.tsx → Copy to components/MinerFlowsView/index.tsx
```

#### Types (1 file)
```
frontend/src/types/index.ts → Copy only these interfaces:
  - SubnetType
  - CategoryType
  - MetricType
```

#### Assets
```
frontend/public/logos/ → Copy entire directory (all .webp files)
```

### Data Files to Create

#### 1. Real Subnet Identities Data
Create `frontend/src/data/subnets.json`:
```json
[
  {
    "id": "SN1",
    "name": "Text Prompting",
    "category": "AI Tools & Applications",
    "netuid": 1
  },
  {
    "id": "SN8",
    "name": "Taoshi",
    "category": "Trading & DeFi",
    "netuid": 8
  }
  // ... etc for all subnets
]
```

#### 2. Mock Data Generators Documentation
Create `frontend/src/data/mockDataGenerators.ts` - Extract all mock data generation functions from:
- DatasetsView.tsx: `generateMockData()`, `seededRandom()`
- InstitutionalDashboard.tsx: `seededScore()`, `getSubnetNumber()`
- MinerFlowsView.tsx: All `generate*` functions

#### 3. Data Requirements Document
Create `DATA_REQUIREMENTS.md` documenting what real data backend needs to provide.

---

## Mock Data Currently Used

### In DatasetsView (Overview Tab)
```typescript
interface OverviewMetrics {
  // Social metrics (MOCK)
  xFollowers: number;
  discordMessages30d: number;
  daysSinceLastDiscord: number;

  // Development metrics (MOCK)
  githubCommits30d: number;
  daysSinceLastCommit: number;
  websiteTraffic30d: number;

  // On-chain metrics (MOCK)
  taoInflow: number;       // TAO inflow amount
  taoInflow7d: number;     // 7d change %
  emissions7d: number;     // 7d emissions change %
}
```

### In DatasetsView (Miner Flows Tab)
```typescript
interface MinerFlowMetrics {
  // Sales metrics (MOCK)
  minerSales1d: number;           // TAO sold in 1 day
  minerSales7d: number;           // TAO sold in 7 days
  minerSales30d: number;          // TAO sold in 30 days
  minerSellingRatio30d: number;   // % of emissions sold

  // Holding periods (MOCK)
  percentSold1d: number;          // % sold within 1 day
  percentSold3d: number;          // % sold within 3 days
  percentSold7d: number;          // % sold within 7 days
  percentSold14d: number;         // % sold within 14 days
  percentSoldOver30d: number;     // % sold after 30+ days
  avgHoldingDays30d: number;      // Average holding time

  // Advanced metrics (MOCK)
  minerExtractionBeta: number;    // Sensitivity to market moves
  minerDumpResponse: number;      // Response to dumps (%)
  minerPumpResponse: number;      // Response to pumps (%)
}
```

### In MinerFlowsView Component
```typescript
interface MinerFlowChartData {
  // Time series data (MOCK)
  alphaSold: Array<{
    date: string;
    tao: number;
    usd: number;
  }>;

  // Sell-through rate (MOCK)
  sellThroughRate: Array<{
    date: string;
    rate: number;  // Percentage
  }>;

  // Holding period distribution (MOCK)
  holdingPeriods: {
    '<1d': number;    // Percentage
    '1-3d': number;
    '3-7d': number;
    '7-14d': number;
    '>14d': number;
  };

  // Beta series for correlation (MOCK)
  betaSeries: Array<{
    date: string;
    value: number;
  }>;

  // Price returns (MOCK)
  priceReturns: number[];  // Daily return percentages
}
```

### In MinerFlowsDashboard (Bubble Chart)
```typescript
interface BubbleChartMetrics {
  // Index scores 0-100 (MOCK)
  'Health Index': number;
  'Sentiment Index': number;
  'Execution Index': number;
  'Traction Index': number;
  'Incentives Index': number;
  'On-chain Index': number;
}
```

---

## Dependencies

### NPM Packages Required
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "recharts": "^2.10.0",
    "lucide-react": "latest",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "vite": "^5.0.0"
  }
}
```

### Python Requirements (Backend Reference)
```
requests>=2.31.0
pandas>=2.0.0
python-dotenv>=1.0.0
```

---

## Simplifications for Standalone Repo

### Remove These Dependencies
- ❌ AuthContext (no authentication needed)
- ❌ WatchlistContext (not used in these views)
- ❌ CacheService (simplify to direct data loading)
- ❌ StorageService (not needed for demo)
- ❌ Billing/subscription logic
- ❌ Analytics tracking

### Simplify These Components
- **DataContext** → Simple hook that loads from `subnets.json` + mock generators
- **InstitutionalDashboard** → Remove sidebar navigation, only keep Miner Flows view
- **Routing** → Just 2 routes: `/` (Miner Flows) and `/datasets`

---

## New App.tsx Structure

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DatasetsView from './pages/DatasetsView';
import MinerFlowsDashboard from './pages/MinerFlowsDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MinerFlowsDashboard />} />
        <Route path="/datasets" element={<DatasetsView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

---

## Simplified Data Loading Hook

Create `frontend/src/hooks/useSubnetData.ts`:

```typescript
import { useState, useEffect } from 'react';
import subnetsData from '../data/subnets.json';
import { generateMockData } from '../data/mockDataGenerators';

export const useSubnetData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading real subnet identities
    setTimeout(() => {
      const enrichedData = subnetsData.map(subnet => ({
        ...subnet,
        // Add mock data for all metrics
        ...generateMockData(subnet.id)
      }));

      setData(enrichedData);
      setLoading(false);
    }, 500);
  }, []);

  return { data, loading };
};
```

---

## Key Files to Extract Mock Data From

### 1. From DatasetsView.tsx
**Lines to extract**: 142-198 (seededRandom + generateMockData functions)

### 2. From InstitutionalDashboard.tsx
**Lines to extract**: 119-133 (seededScore + getSubnetNumber functions)

### 3. From MinerFlowsView.tsx
**Lines to extract**: 64-434 (All generate* functions including):
- generateAlphaSoldTimeSeries
- generatePriceSumHistory
- generateBetaSeries
- generatePriceReturnSeries
- generateSellThroughRate
- generateHoldingPeriods
- Helper functions

---

## Next Steps

1. **Extract subnet identities** from current data into JSON
2. **Copy listed files** to new repo structure
3. **Extract mock data generators** into standalone file
4. **Simplify components** by removing unused dependencies
5. **Create DATA_REQUIREMENTS.md** documenting what backend dev needs to build
6. **Test standalone app** with mock data
7. **Share with backend dev** as UI specification

---

## Backend Developer Deliverables

The backend developer should provide APIs/data matching these schemas:

1. **Miner Sales Endpoint**: `GET /api/miner-sales/:subnetId?days=30`
2. **Social Metrics Endpoint**: `GET /api/social-metrics/:subnetId`
3. **Development Metrics Endpoint**: `GET /api/dev-metrics/:subnetId`
4. **On-chain Metrics Endpoint**: `GET /api/onchain-metrics/:subnetId`

See `DATA_REQUIREMENTS.md` for complete API specifications.
