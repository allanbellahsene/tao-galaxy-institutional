# Miner Flows & Datasets - Backend Data Requirements

## Overview

This document specifies the exact data structures needed to replace the mock data currently used in the Miner Flows and Datasets UI.

**Current State**: All data except subnet identities (ID, name, logo) is generated using mock/seeded random data.

**Target State**: Backend APIs provide real data matching the structures documented below.

---

## 1. Subnet Identity Data (✅ Already Available)

### Source
Static data file: `subnets.json`

### Structure
```json
[
  {
    "id": "SN1",
    "name": "Text Prompting",
    "category": "AI Tools & Applications",
    "netuid": 1,
    "rank": 1,
    "price": 0.0123,
    "emissions": 2.5,
    "marketCap": 1234567
  }
]
```

### Fields
- `id` (string): Subnet identifier (e.g., "SN1", "SN8")
- `name` (string): Human-readable subnet name
- `category` (string): Subnet category/vertical
- `netuid` (number): Network UID (1, 8, 64, etc.)
- `rank` (number): Market cap ranking
- `price` (number): Current token price in TAO
- `emissions` (number): % of total TAO emissions
- `marketCap` (number): Market cap in USD

---

## 2. Social Metrics (❌ Currently Mock)

### API Endpoint Needed
```
GET /api/social-metrics
GET /api/social-metrics/:subnetId
```

### Response Schema
```typescript
{
  "subnetId": "SN8",
  "metrics": {
    // Twitter/X metrics
    "xFollowers": 12543,
    "xFollowers7dChange": 234,      // New followers in 7d
    "xFollowers30dChange": 1205,    // New followers in 30d

    // Discord metrics
    "discordMembers": 5432,
    "discordMessages30d": 8765,     // Total messages in 30d
    "discordActiveUsers30d": 234,   // Active users in 30d
    "daysSinceLastDiscord": 2,      // Days since last message

    // Website traffic
    "websiteTraffic30d": 45678,     // Monthly visits
    "websiteTraffic7dChange": -234  // % change in 7d
  },
  "timestamp": "2025-01-05T12:00:00Z"
}
```

### Data Sources
- **Twitter/X**: Twitter API or web scraping
- **Discord**: Discord API (requires bot access)
- **Website**: Google Analytics, SimilarWeb, or server logs

---

## 3. Development Metrics (❌ Currently Mock)

### API Endpoint Needed
```
GET /api/dev-metrics
GET /api/dev-metrics/:subnetId
```

### Response Schema
```typescript
{
  "subnetId": "SN8",
  "metrics": {
    // GitHub activity
    "githubCommits30d": 156,        // Commits in last 30 days
    "githubCommits7d": 23,          // Commits in last 7 days
    "daysSinceLastCommit": 1,       // Days since last commit
    "githubContributors30d": 5,     // Active contributors
    "githubPRs30d": 12,             // Pull requests
    "githubIssuesClosed30d": 8,     // Issues closed

    // Code stats
    "linesOfCodeChanged30d": 2345,  // Lines changed
    "filesChanged30d": 45,          // Files modified

    // Repository health
    "stars": 234,
    "forks": 56,
    "openIssues": 12
  },
  "timestamp": "2025-01-05T12:00:00Z"
}
```

### Data Sources
- **GitHub API**: All metrics available via GitHub REST/GraphQL API
- **Script Reference**: Current repo has `backend/reports/advanced_scrapers.py` that might have GitHub scraping logic

---

## 4. On-Chain Metrics (❌ Currently Mock)

### API Endpoint Needed
```
GET /api/onchain-metrics
GET /api/onchain-metrics/:subnetId
```

### Response Schema
```typescript
{
  "subnetId": "SN8",
  "metrics": {
    // TAO flows
    "taoInflow": 1234.56,           // TAO inflow (30d total)
    "taoOutflow": 987.65,           // TAO outflow (30d total)
    "netInflow": 246.91,            // Net inflow (inflow - outflow)

    // Changes over time
    "taoInflow7dChange": 12.5,      // % change in 7d
    "taoInflow30dChange": -3.2,     // % change in 30d
    "emissions7dChange": 0.5,       // % change in emissions allocation

    // Network stats
    "activeValidators": 64,
    "activeMiners": 256,
    "stakingRatio": 67.8            // % of supply staked
  },
  "timestamp": "2025-01-05T12:00:00Z"
}
```

### Data Sources
- **Bittensor Chain**: Query directly from chain
- **TaoStats API**: May provide these metrics
- **Block explorers**: Taostats.io or similar

---

## 5. Miner Flow Metrics (❌ Currently Mock - HIGHEST PRIORITY)

This is the core feature. Backend should implement the logic described in `backend/miner_flows.py`.

### API Endpoints Needed

#### 5.1 Miner Sales Summary
```
GET /api/miner-flows/sales/:subnetId?days=30
```

**Response Schema**:
```typescript
{
  "subnetId": "SN8",
  "period": "30d",
  "metrics": {
    // Sales amounts
    "minerSales1d": 123.45,         // TAO sold in 1 day
    "minerSales7d": 890.12,         // TAO sold in 7 days
    "minerSales30d": 3456.78,       // TAO sold in 30 days

    // Selling pressure
    "minerSellingRatio30d": 45.6,   // (Sales / Emissions) * 100
    "avgDailySales": 115.23,        // Average daily sales

    // USD equivalent (if TAO price available)
    "minerSales30dUSD": 1209876.50
  },
  "timestamp": "2025-01-05T12:00:00Z"
}
```

#### 5.2 Holding Periods
```
GET /api/miner-flows/holding-periods/:subnetId?days=30
```

**Response Schema**:
```typescript
{
  "subnetId": "SN8",
  "period": "30d",
  "holdingPeriods": {
    // Distribution of holding times (percentages, must sum to 100)
    "lessThan1d": 15.2,             // % sold within 1 day
    "oneToThreeDays": 22.8,         // % sold in 1-3 days
    "threeToSevenDays": 31.5,       // % sold in 3-7 days
    "sevenToFourteenDays": 18.3,    // % sold in 7-14 days
    "moreThan14Days": 12.2,         // % sold after 14+ days

    // Weighted average
    "avgHoldingDays": 6.7           // Weighted average holding time
  },
  "timestamp": "2025-01-05T12:00:00Z"
}
```

#### 5.3 Time Series Data
```
GET /api/miner-flows/timeseries/:subnetId?days=30
```

**Response Schema**:
```typescript
{
  "subnetId": "SN8",
  "period": "30d",
  "data": [
    {
      "date": "2025-01-05",
      "taoSold": 145.67,            // TAO sold that day
      "usdValue": 50983.45,         // USD equivalent
      "sellThroughRate": 67.8,      // % of emissions sold
      "priceReturn": 2.3            // Daily price return %
    }
    // ... one entry per day
  ],
  "timestamp": "2025-01-05T12:00:00Z"
}
```

#### 5.4 Advanced Miner Behavior Metrics
```
GET /api/miner-flows/behavior/:subnetId?days=90
```

**Response Schema**:
```typescript
{
  "subnetId": "SN8",
  "period": "90d",
  "behavior": {
    // Market sensitivity
    "minerExtractionBeta": 0.85,    // Correlation with price (0-2)
                                     // <1: Less responsive to market
                                     // >1: More responsive to market

    // Response to dumps (price drops > 1 std dev)
    "minerDumpResponse": -8.5,      // % change in selling ratio during dumps
                                     // Negative: Reduce selling during dumps (good)
                                     // Positive: Increase selling during dumps (bad)

    // Response to pumps (price rises > 1 std dev)
    "minerPumpResponse": 12.3,      // % change in selling ratio during pumps
                                     // Positive: Increase selling during pumps (taking profit)
                                     // Negative: Reduce selling during pumps (holding)

    // Consistency
    "sellingVolatility": 23.4       // Standard deviation of daily selling %
  },
  "timestamp": "2025-01-05T12:00:00Z"
}
```

### Calculation Logic

Reference implementation exists in `backend/miner_flows.py`:

**Key Steps**:
1. **Identify miners** for each subnet (exclude validators)
2. **Track unstaking events** (undelegation) via TaoStats API
3. **Filter to miner unstaking** only (delegate = miner hotkey)
4. **Aggregate by time periods** (1d, 7d, 30d)
5. **Calculate holding periods** by time between emission and unstaking
6. **Compute behavioral metrics** by correlating with price movements

**Data Source**: TaoStats API
- Metagraph endpoint: Get list of miners
- Delegation endpoint: Get unstaking events

**Current Script Configuration**:
```python
TAOSTATS_API_KEY = "tao-05371483-542b-406c-92c0-ef1a4a0d2ef1:5d943abb"
SUBNETS_ENDPOINT = "api/subnet/identity/v1"
METAGRAPH_ENDPOINT = "api/metagraph/latest/v1"
DELEGATION_ENDPOINT = "api/delegation/v1"
```

---

## 6. Technical Metrics (❌ Currently Mock)

### API Endpoint Needed
```
GET /api/technical-metrics
GET /api/technical-metrics/:subnetId
```

### Response Schema
```typescript
{
  "subnetId": "SN8",
  "metrics": {
    // Price metrics
    "price": 0.0123,                // Current price in TAO
    "priceChange1d": 2.5,           // % change in 24h
    "priceChange7d": -1.2,          // % change in 7d
    "priceChange30d": 15.7,         // % change in 30d

    // Volume
    "volume24h": 12345.67,          // 24h trading volume in TAO
    "volume7d": 98765.43,           // 7d trading volume

    // Market cap
    "marketCap": 1234567.89,        // Current market cap in USD
    "fullyDilutedValuation": 2000000, // FDV

    // Volatility
    "volatility30d": 45.6,          // 30d annualized volatility %
    "beta": 1.23                    // Beta vs TAO (if applicable)
  },
  "timestamp": "2025-01-05T12:00:00Z"
}
```

---

## 7. Index Scores (❌ Currently Mock)

These are composite scores used in the bubble chart visualization.

### API Endpoint Needed
```
GET /api/index-scores
GET /api/index-scores/:subnetId
```

### Response Schema
```typescript
{
  "subnetId": "SN8",
  "scores": {
    // All scores are 0-100
    "healthIndex": 78,              // Overall subnet health
    "sentimentIndex": 65,           // Community sentiment
    "executionIndex": 82,           // Team execution quality
    "tractionIndex": 71,            // User/market traction
    "incentivesIndex": 88,          // Incentive mechanism quality
    "onchainIndex": 76              // On-chain activity/health
  },
  "timestamp": "2025-01-05T12:00:00Z"
}
```

### Score Calculation Methodology

Each index should be calculated from underlying metrics:

**Health Index**: Combination of:
- On-chain activity (validators, miners, stake)
- Price stability (low volatility = higher score)
- Development activity (commits, releases)

**Sentiment Index**: Combination of:
- Social media growth trends
- Discord activity trends
- Community feedback sentiment analysis

**Execution Index**: Combination of:
- Development velocity (commits, PRs merged)
- Roadmap completion rate
- Bug fix response time

**Traction Index**: Combination of:
- User growth metrics
- Transaction volume growth
- Market cap growth

**Incentives Index**: Analysis of:
- Miner retention (low churn = higher score)
- Validator decentralization
- Token distribution fairness

**On-chain Index**: Combination of:
- Transaction count
- Active addresses
- Network utilization

---

## Implementation Priority

### Phase 1 (Critical - MVP)
1. ✅ **Subnet identities** (already have)
2. **Miner flow metrics** (APIs 5.1-5.4)
   - Start with basic sales summary
   - Then add holding periods
   - Then time series
   - Finally advanced behavior metrics

### Phase 2 (Important)
3. **Social metrics** (API 2)
4. **Development metrics** (API 3)
5. **On-chain metrics** (API 4)

### Phase 3 (Nice to have)
6. **Technical metrics** (API 6)
7. **Index scores** (API 7)

---

## Data Refresh Requirements

### Real-time (< 5 min delay)
- Price data
- Volume data

### Hourly
- On-chain metrics (TAO flows)
- Miner sales data

### Daily
- Social metrics (followers, messages)
- Development metrics (commits, PRs)
- Holding period distributions
- Index scores

### Weekly
- Advanced behavioral metrics (beta, responses)

---

## Testing & Validation

### Sample Data Needed

For testing, provide sample responses for at least 3 subnets:
- SN1 (high market cap)
- SN8 (medium market cap)
- SN64 (any market cap)

### Validation Checks

**Miner Sales**:
- ✅ Sales amounts should be > 0
- ✅ 30d sales should be ≈ sum of daily sales
- ✅ Selling ratio should be < 100% normally

**Holding Periods**:
- ✅ All percentages must sum to 100%
- ✅ Each percentage should be 0-100
- ✅ Average holding days should be weighted correctly

**Time Series**:
- ✅ Should have entry for each day in period
- ✅ Dates should be continuous (no gaps)
- ✅ Values should be non-negative

---

## Error Handling

All API responses should include error handling:

```typescript
{
  "success": false,
  "error": {
    "code": "SUBNET_NOT_FOUND",
    "message": "Subnet SN999 does not exist",
    "details": {}
  }
}
```

### Error Codes
- `SUBNET_NOT_FOUND`: Invalid subnet ID
- `INSUFFICIENT_DATA`: Not enough historical data for calculation
- `INVALID_PERIOD`: Invalid time period requested
- `RATE_LIMIT`: API rate limit exceeded
- `UPSTREAM_ERROR`: Error from TaoStats or other upstream API

---

## API Response Standards

### General Format
```typescript
{
  "success": true,
  "data": { /* actual data here */ },
  "metadata": {
    "timestamp": "2025-01-05T12:00:00Z",
    "dataAsOf": "2025-01-05T11:00:00Z",  // When data was last updated
    "version": "1.0"
  }
}
```

### Pagination (for list endpoints)
```typescript
{
  "success": true,
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalPages": 3,
    "totalItems": 128
  }
}
```

---

## Backend Reference Scripts

Existing scripts in `backend/` that may help:

1. **miner_flows.py**
   - Fetches miner unstaking events
   - Calculates sales by subnet
   - Outputs CSV files
   - **Use as reference for miner flow calculations**

2. **miner_flow_blockchain.py**
   - Additional blockchain analysis
   - May contain helper functions

3. **README_MINER_FLOWS.md**
   - Complete documentation of miner flow logic
   - Explains TaoStats API usage

---

## Questions for Backend Developer

1. What is the preferred API architecture? (REST, GraphQL, gRPC)
2. What authentication method should be used? (API keys, JWT, none for demo)
3. Should data be cached? What caching strategy? (Redis, in-memory, etc.)
4. What database will store historical data? (PostgreSQL, TimescaleDB, etc.)
5. How often should data refresh jobs run? (cron, continuous, on-demand)
6. Should we expose raw CSV exports like `miner_flows.py` does?

---

## Contact & Collaboration

- Review the UI at: `/` (Miner Flows Dashboard) and `/datasets`
- All mock data generators are in: `frontend/src/data/mockDataGenerators.ts`
- Questions? Check UI behavior to understand expected data structure
