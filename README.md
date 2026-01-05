# Miner Flows & Datasets - Standalone UI Demo

This is a standalone repository containing the **Miner Flows** and **Datasets** UI features extracted from the main TAO Galaxy application.

## Purpose

This demo serves as a **UI specification** for backend developers to understand what data structures and APIs they need to build.

**Current State**: All data except subnet identities (ID, name, logo) is **mock/generated data**.

**Target State**: Backend APIs provide real data matching the schemas in `docs/DATA_REQUIREMENTS.md`.

## Features

### 1. Miner Flows Dashboard (`/`)
- Visualizations of miner selling behavior
- Time-series charts showing TAO sales over time
- Holding period distributions
- Top movers analysis
- Correlation metrics

### 2. Datasets View (`/datasets`)
- Comprehensive subnet data table
- Multiple tabs:
  - **Overview**: Social, development, on-chain metrics
  - **Technical**: Price, volume, market cap
  - **On-Chain**: TAO flows, emissions
  - **Development**: GitHub activity
  - **Social**: Twitter/Discord/website metrics
  - **Miner Flows**: Sales, holding periods, behavior metrics
- Sortable columns
- Category filtering
- Search functionality

## Quick Start

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000

### Backend Reference

The backend scripts in `backend/` show how miner flow data is currently fetched:

```bash
cd backend
pip install -r requirements.txt
python miner_flows.py
```

See `backend/README_MINER_FLOWS.md` for details.

## Documentation

- **`docs/DATA_REQUIREMENTS.md`**: Complete API specifications for backend developers
- **`docs/MINER_FLOWS_MIGRATION.md`**: How this repo was created
- **`backend/README_MINER_FLOWS.md`**: Miner flows data collection explained

## Current Data Sources

### Real Data (✅)
- Subnet identities: ID, name, category, netuid
- Subnet logos (in `frontend/public/logos/`)

### Mock Data (❌)
Everything else is currently generated using seeded random functions:
- Social metrics (Twitter followers, Discord messages, etc.)
- Development metrics (GitHub commits, PRs, etc.)
- On-chain metrics (TAO inflows, emissions changes)
- Miner flow metrics (sales amounts, holding periods, behavioral metrics)
- Technical metrics (price, volume, market cap)
- Index scores (health, sentiment, execution, etc.)

## For Backend Developers

1. **Review the UI**: Run `npm run dev` and explore both pages
2. **Check mock data generators**: See `frontend/src/data/mockDataGenerators.ts`
3. **Read API requirements**: See `docs/DATA_REQUIREMENTS.md`
4. **Reference implementation**: See `backend/miner_flows.py` for miner flow calculations
5. **Ask questions**: The UI behavior shows exactly what data structure is expected

## Tech Stack

### Frontend
- React 18 + TypeScript
- React Router for navigation
- Recharts for data visualization
- Tailwind CSS for styling
- Vite for build tooling

### Backend (Reference)
- Python 3.x
- Pandas for data manipulation
- TaoStats API for blockchain data

## Next Steps

1. ✅ Review UI and understand data requirements
2. ⏳ Implement backend APIs per `docs/DATA_REQUIREMENTS.md`
3. ⏳ Replace mock data generators with real API calls
4. ⏳ Test with real data
5. ⏳ Deploy

## Questions?

- Review the mock data generators to understand data structures
- Check the UI to see how data is visualized
- Read `docs/DATA_REQUIREMENTS.md` for complete API specs
