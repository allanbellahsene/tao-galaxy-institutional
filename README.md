# TAO Galaxy Institutional

**Professional-grade analytics and intelligence platform for institutional investors in the Bittensor ecosystem.**

---

## Overview

TAO Galaxy Institutional is a comprehensive analytics platform designed for institutional investors, fund managers, and professional traders who need deep insights into Bittensor subnet dynamics, miner behavior, and on-chain flows.

This repository contains the development version of the institutional product, starting with two core features:
1. **Miner Flows Analytics** - Track miner selling behavior, holding periods, and market sensitivity
2. **Comprehensive Datasets** - Multi-dimensional subnet analytics across social, technical, and on-chain metrics

## 🎯 Product Vision

TAO Galaxy Institutional provides institutions with:
- **Miner Behavior Intelligence**: Understand when and how miners are selling their rewards
- **Comprehensive Subnet Data**: Social, development, on-chain, and technical metrics in one place
- **Professional-grade Visualizations**: Interactive charts and tables built for data-driven decision making
- **Real-time Market Intelligence**: Track sentiment, execution, and traction across all subnets

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/tao-galaxy-institutional.git
cd tao-galaxy-institutional

# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

Visit http://localhost:3000 to see the platform.

---

## 📊 Core Features

### 1. Miner Flows Dashboard (`/`)

Advanced analytics on miner selling behavior:

- **Time-Series Analysis**: Daily TAO sales trends across subnets
- **Holding Period Distributions**: Understand how long miners hold before selling
- **Market Sensitivity Metrics**: Beta, dump response, pump response
- **Sell-Through Rates**: Track what percentage of emissions are being sold
- **Top Movers**: Identify subnets with highest miner selling pressure
- **Correlation Analysis**: Price returns vs. miner selling behavior

**Key Metrics Tracked**:
- Total TAO sold (1d, 7d, 30d)
- Miner selling ratio (sales/emissions)
- Average holding periods
- Extraction beta (sensitivity to price movements)
- Response to market dumps and pumps

### 2. Datasets View (`/datasets`)

Comprehensive multi-dimensional subnet analytics:

#### Tabs:
- **Overview**: High-level metrics (price, market cap, emissions, inflows)
- **Technical**: Price action, volume, volatility
- **On-Chain**: TAO flows, emissions, network metrics
- **Development**: GitHub activity, commit velocity, contributor count
- **Social**: Twitter/X, Discord, website traffic
- **Miner Flows**: Detailed miner behavior metrics

#### Features:
- **Sortable columns** across all metrics
- **Category filtering** (Compute, AI Tools, Trading, etc.)
- **Search functionality** by subnet name or ID
- **Aggregate statistics** at the bottom of tables
- **Currency toggle** (TAO/USD) for miner flow metrics
- **Export capabilities** (coming soon)

---

## 🏗️ Development Status

### Current State

✅ **Frontend Complete**: Full UI with interactive visualizations
✅ **Real Data**: Subnet identities (93 subnets with IDs, names, categories, logos)
⏳ **Backend Integration**: Currently using mock data generators

### Mock Data (Temporary)

The following metrics are currently generated using seeded random functions:

- Social metrics (Twitter followers, Discord activity, website traffic)
- Development metrics (GitHub commits, PRs, code changes)
- On-chain metrics (TAO inflows/outflows, emissions changes)
- **Miner flow metrics** (sales, holding periods, behavioral metrics)
- Technical metrics (price, volume beyond current snapshot)
- Index scores (health, sentiment, execution, traction)

**Why Mock Data?**
The UI serves as a specification for backend developers, showing exactly what data structures and APIs need to be built. All mock generators will be replaced with real API calls.

---

## 📁 Repository Structure

```
tao-galaxy-institutional/
├── README.md                          # This file
├── GITHUB_SETUP.md                    # How to push to GitHub
│
├── docs/
│   ├── DATA_REQUIREMENTS.md           # Backend API specifications
│   └── MINER_FLOWS_MIGRATION.md       # Technical migration details
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── MinerFlowsDashboard.tsx    # Main dashboard
│   │   │   └── DatasetsView.tsx           # Data tables
│   │   ├── components/
│   │   │   └── MinerFlowsView/            # Charts & visualizations
│   │   ├── data/
│   │   │   └── subnets.json               # 93 real subnets
│   │   └── types/
│   │       └── index.ts                   # TypeScript definitions
│   └── public/
│       └── logos/                          # Subnet logos
│
└── backend/
    ├── miner_flows.py                     # Reference: How to fetch miner data
    ├── README_MINER_FLOWS.md              # Miner flows documentation
    └── requirements.txt                    # Python dependencies
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Routing**: React Router v6
- **Visualization**: Recharts (time-series, scatter, pie, bar charts)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Date Handling**: date-fns

### Backend (Reference Implementation)
- **Language**: Python 3.10+
- **Data Processing**: Pandas
- **API Integration**: TaoStats API
- **Data Storage**: CSV exports (to be replaced with database)

---

## 📖 Documentation

### For Developers

1. **[DATA_REQUIREMENTS.md](docs/DATA_REQUIREMENTS.md)**
   Complete API specifications for all backend endpoints. Includes:
   - Request/response schemas
   - Data validation rules
   - Implementation priorities
   - Error handling

2. **[Backend README](backend/README_MINER_FLOWS.md)**
   Deep dive into miner flow calculation logic:
   - How unstaking events are tracked
   - TaoStats API usage
   - Holding period calculations
   - Behavioral metrics methodology

3. **[Migration Guide](docs/MINER_FLOWS_MIGRATION.md)**
   Technical details on how this repo was created

### For Users

Run the application and explore! The UI is self-documenting:
- Hover over metrics for definitions
- Check info icons for calculation details
- Review charts to understand data visualization

---

## 🔄 Development Workflow

### Phase 1: Backend API Development (Current)

**Objective**: Replace all mock data with real APIs

**Priority Order**:
1. ✅ Miner flow metrics (highest value)
2. Social metrics (Twitter, Discord, website)
3. Development metrics (GitHub)
4. On-chain metrics (TAO flows)
5. Index scores (composite metrics)

**Reference**: See `docs/DATA_REQUIREMENTS.md` for complete API specs

### Phase 2: Real-time Integration

- WebSocket connections for live price updates
- Streaming miner flow data
- Real-time alerts and notifications

### Phase 3: Advanced Features

- Custom alerts and watchlists
- Portfolio tracking integration
- Advanced filtering and segmentation
- Data export (CSV, API access)
- White-label options for institutional clients

---

## 🎨 UI Features

### Design Principles

- **Dark/Light Mode**: Full theme support
- **Responsive**: Works on desktop, tablet, and mobile
- **Professional**: Clean, institutional-grade interface
- **Data-Dense**: Maximum information, minimal clutter
- **Interactive**: Sortable, filterable, searchable everything

### Visualizations

- **Bubble Charts**: Multi-dimensional subnet analysis
- **Time-Series**: Price, volume, miner flows over time
- **Pie Charts**: Holding period distributions
- **Bar Charts**: Top movers, category comparisons
- **Heatmaps**: Coming soon
- **Network Graphs**: Coming soon

---

## 🔐 Data Sources

### Current

- **Subnet Identities**: 93 subnets with official IDs, names, categories
- **Logos**: High-quality subnet logos
- **Mock Generators**: Seeded random data for development

### Planned

- **TaoStats API**: On-chain data, delegation events, metagraph
- **Twitter API**: Follower counts, engagement metrics
- **Discord API**: Member counts, message activity
- **GitHub API**: Commits, PRs, contributors, code stats
- **Custom Scrapers**: Website traffic, sentiment analysis
- **Price Feeds**: Real-time and historical price data

---

## 🚦 Roadmap

### Q1 2025
- ✅ UI/UX development complete
- ⏳ Backend API implementation
- ⏳ Miner flows real data integration
- ⏳ Social metrics integration
- ⏳ Beta launch for select institutions

### Q2 2025
- Real-time data streaming
- Advanced filtering and segmentation
- Custom alert system
- Portfolio tracking
- API access for institutional clients

### Q3 2025
- White-label solutions
- Custom reports and analytics
- Advanced charting and analysis tools
- Integration with trading platforms

---

## 🤝 Contributing

This is currently a private institutional product. If you're interested in contributing or partnering, please contact the team.

### For Backend Developers

1. Review the UI to understand requirements
2. Read `docs/DATA_REQUIREMENTS.md` for API specs
3. Check `backend/miner_flows.py` for reference implementation
4. Implement APIs matching the documented schemas
5. Test integration with frontend

---

## 📞 Support & Contact

- **Documentation**: See `docs/` directory
- **Technical Issues**: The UI shows expected data structures
- **Feature Requests**: Contact the product team
- **Partnership Inquiries**: Contact institutional@taogalaxy.com (example)

---

## 📄 License

Proprietary - All Rights Reserved

---

## 🙏 Acknowledgments

Built on top of the Bittensor ecosystem:
- **TaoStats** for on-chain data access
- **Bittensor Foundation** for the protocol
- **Subnet developers** for building amazing applications

---

**TAO Galaxy Institutional** - Professional intelligence for institutional investors in the Bittensor ecosystem.
