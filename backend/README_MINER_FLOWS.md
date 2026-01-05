# Miner Flows Script - Technical Documentation

## Overview

The `miner_flows.py` script tracks TAO token unstaking (undelegation) events from miners across Bittensor subnets over a specified time period. It uses the TaoStats API to fetch delegation data and identifies which unstaking events came from miners (as opposed to validators).

## Purpose

**Main Goal**: Track when ALPHA tokens are being removed from miners (unstaked/undelegated) to understand miner cash flows and selling pressure.


## Key Bittensor Concepts

### Hotkey vs Coldkey

- **Hotkey**: The operational address used by miners/validators to participate in the network. Think of it as a "worker" address that actively participates in consensus and validation.
- **Coldkey**: The owner's address that controls the hotkey and holds the actual TAO tokens. Think of it as a "wallet" address.
- **Delegation**: Coldkeys can delegate (stake) TAO to hotkeys to support them. When they unstake (undelegate), they remove TAO from that hotkey.

### Miners vs Validators

- **Validators**: Nodes with `validator_permit = true` that validate subnet computations
- **Miners**: Nodes with `validator_permit = false` that perform actual work/computations
- **This script focuses only on miners** - it filters out validators when tracking unstaking events

### Delegation Events

When a coldkey unstakes TAO from a hotkey, the TaoStats API records it as an `UNDELEGATE` event with:
- `nominator`: The coldkey (owner) unstaking the TAO
- `delegate`: The hotkey (miner/validator) that the TAO is being removed from
- `amount`: Amount of TAO being unstaked (in RAO - smallest unit, 1 TAO = 1e9 RAO)
- `netuid`: The subnet where this occurred

## How The Script Works

### Step 1: Fetch All Subnets

```python
get_all_subnets()
```

Calls TaoStats API endpoint `api/subnet/identity/v1` to get list of all active subnets.

**Optional**: Filter to specific subnets using `SPECIFIC_SUBNETS` configuration.

### Step 2: For Each Subnet, Identify Miners

```python
get_miner_hotkeys_for_subnet(netuid)
```

For each subnet:
1. Fetches the metagraph (network state) from TaoStats API: `api/metagraph/latest/v1`
2. Iterates through all neurons (nodes) in the subnet
3. Filters for miners only: `validator_permit = false` or `is_validator = false`
4. Extracts their hotkey addresses
5. Returns a set of miner hotkeys for that subnet

**Key Point**: We need to know who the miners are so we can filter unstaking events to only include miner-related events (ignoring validator unstaking).

### Step 3: Fetch Unstaking Events

```python
get_unstaking_events(netuid, start_date, end_date)
```

For each subnet, fetches undelegation events from TaoStats API:
- Endpoint: `api/delegation/v1`
- Parameters:
  - `netuid`: Subnet ID
  - `action`: "undelegate" (only unstaking events)
  - `timestamp_start`: Unix timestamp for date range start
  - `timestamp_end`: Unix timestamp for date range end
  - `limit`: 200 events per request (max allowed)

Returns raw event data from the API.

### Step 4: Process and Filter Events

```python
process_subnet(netuid, start_date, end_date)
```

For each unstaking event:

1. **Extract the delegate (hotkey)**:
   ```python
   delegate = event.get('delegate')
   hotkey = delegate.get('ss58')  # Bittensor SS58 address format
   ```

2. **Extract the nominator (coldkey)**:
   ```python
   nominator = event.get('nominator')
   coldkey = nominator.get('ss58')  # Owner's address
   ```

3. **Check if the delegate is a miner**:
   ```python
   if hotkey in miners:  # Only process if hotkey belongs to a miner
   ```

4. **Convert amount from RAO to TAO**:
   ```python
   tao_amount = float(raw_amount) / 1e9
   ```

5. **Extract other fields**:
   - `timestamp`: When the unstaking occurred
   - `extrinsic_id`: Blockchain transaction ID
   - `netuid`: Subnet ID

6. **Create record**:
   ```python
   {
       'date': pd.to_datetime(timestamp).date(),
       'netuid': netuid,
       'tao_amount': tao_amount,
       'hotkey': hotkey,           # Miner's hotkey
       'coldkey': coldkey,          # Owner who unstaked
       'extrinsic_id': extrinsic_id
   }
   ```

**Critical Filter**: Only events where `hotkey in miners` are included. This excludes:
- Unstaking from validators
- Unstaking from hotkeys that aren't currently in the subnet

### Step 5: Aggregate All Data

```python
fetch_all_miner_sales(days_back, subnet_ids)
```

1. Processes all subnets (or filtered list)
2. Combines all subnet dataframes into one
3. Returns combined dataframe with all miner unstaking events

### Step 6: Create Pivot Table

```python
create_pivot_table(df)
```

Transforms the raw transaction data into a date × subnet matrix:

1. **Groups by**: `date`, `netuid`, `subnet_name`
2. **Aggregates**: Sums all `tao_amount` per group
3. **Pivots**:
   - Rows: dates
   - Columns: subnet names
   - Values: total TAO unstaked
4. **Adds**: `TOTAL_ALL_SUBNETS` column with row sums

Result: Easy-to-read table showing daily unstaking amounts per subnet.

## Configuration

### Location: Lines 33-43

```python
# Time period
DAYS_BACK = 2  # Number of days to look back

# Subnet filter
SPECIFIC_SUBNETS = [64]  # List of subnet IDs, or None for all subnets
```

### Options:

**Process all subnets**:
```python
SPECIFIC_SUBNETS = None
```

**Process specific subnets only**:
```python
SPECIFIC_SUBNETS = [1, 8, 35]
```

**Change time period**:
```python
DAYS_BACK = 30  # Last 30 days
```

## API Details

### TaoStats API

**Base URL**: `https://api.taostats.io`

**Authentication**: API key in header
```python
Authorization: tao-05371483-542b-406c-92c0-ef1a4a0d2ef1:5d943abb
```

**Rate Limiting**:
- 12 second delay between requests
- Max 3 retries with exponential backoff
- Respects `Retry-After` header on 429 responses

### Key Endpoints Used

1. **Subnets List**: `GET /api/subnet/identity/v1`
   - Returns: List of all active subnets with metadata

2. **Metagraph**: `GET /api/metagraph/latest/v1?netuid={netuid}`
   - Returns: Current network state for a subnet
   - Includes all neurons with their properties (hotkey, validator_permit, etc.)
   - Fallback: `/api/metagraph/history/v1` if latest fails

3. **Delegation Events**: `GET /api/delegation/v1`
   - Parameters:
     - `netuid`: Subnet ID
     - `action`: "undelegate"
     - `timestamp_start`: Unix timestamp
     - `timestamp_end`: Unix timestamp
     - `limit`: 200
   - Returns: List of delegation/undelegation events

### Event Structure

Example undelegation event from API:

```json
{
  "id": "finney-64-0xe824c9...-0xe65fe9...-7205986-63",
  "block_number": 7205986,
  "timestamp": "2025-12-29T17:41:24Z",
  "action": "UNDELEGATE",
  "nominator": {
    "ss58": "5HGmMzVWQiGTWm67rDRbNKEBNQn469nbxUCKsrPYxRM5i2GN",
    "hex": "0xe65fe9b5e27d3448c3d9328815cce22da0654c007e82d792f9a81dd77e525d38"
  },
  "delegate": {
    "ss58": "5HK5tp6t2S59DywmHRWPBVJeJ86T61KjurYqeooqj8sREpeN",
    "hex": "0xe824c935940357af73c961bdd7387e1ab821ec2939ecd19daafe6081ae9ae674"
  },
  "amount": "22720665",
  "netuid": 64,
  "extrinsic_id": "7205986-0018"
}
```

**Field Mapping**:
- `nominator.ss58` → `coldkey` (owner who unstaked)
- `delegate.ss58` → `hotkey` (miner/validator that was unstaked from)
- `amount` → `tao_amount` (converted from RAO to TAO by dividing by 1e9)
- `timestamp` → `date` (converted to date object)

## Output Files

### 1. Raw Data CSV

**Filename**: `miner_sales_raw_subnets_{subnet_ids}_{timestamp}.csv`

**Example**: `miner_sales_raw_subnets_64_20251229_184154.csv`

**Columns**:
- `date`: Date of unstaking event (YYYY-MM-DD)
- `netuid`: Subnet ID (integer)
- `tao_amount`: Amount of TAO unstaked (float)
- `hotkey`: Miner's hotkey address (SS58)
- `coldkey`: Owner's coldkey address (SS58)
- `extrinsic_id`: Blockchain transaction ID
- `subnet_name`: Human-readable subnet name

**Each row**: One unstaking transaction

### 2. Pivot Table CSV

**Filename**: `miner_sales_by_subnet_subnets_{subnet_ids}_{timestamp}.csv`

**Example**: `miner_sales_by_subnet_subnets_64_20251229_184154.csv`

**Format**:
- **Rows**: Dates (one per day)
- **Columns**: Subnet names + TOTAL_ALL_SUBNETS
- **Values**: Total TAO unstaked that day for that subnet

**Example**:
```
date,SN64_AlphaNet,SN8_Subnet8,TOTAL_ALL_SUBNETS
2025-12-27,150.5,0,150.5
2025-12-28,200.3,50.2,250.5
2025-12-29,0,100.1,100.1
```

## Running The Script

### Prerequisites

```bash
pip install requests pandas python-dotenv
```

### Execution

```bash
cd backend
python3 miner_flows.py
```

### Expected Output

```
================================================================================
BITTENSOR MINER FLOW TRACKER
================================================================================
⚠️  FILTERING TO SPECIFIC SUBNETS: [64]
Days back: 2
================================================================================

Step 1: Fetching miner sales data...
2025-12-29 18:41:30,123 - INFO - Fetching miner sales from 2025-12-27 to 2025-12-29
2025-12-29 18:41:30,234 - INFO - Found 50 subnets
2025-12-29 18:41:30,235 - INFO - Filtering to 1 specific subnets: [64]

============================================================
Processing AlphaNet (netuid: 64)
============================================================
2025-12-29 18:41:45,567 - INFO - Found 243 miners in subnet 64
2025-12-29 18:41:58,890 - INFO - Found 15 unstaking events for subnet 64
2025-12-29 18:41:58,891 - INFO - Processed 12 miner sales for subnet 64

✓ Raw data saved: miner_sales_raw_subnets_64_20251229_184200.csv

Step 2: Creating pivot table...
✓ Pivot table saved: miner_sales_by_subnet_subnets_64_20251229_184200.csv

================================================================================
SUMMARY
================================================================================
Date range: 2025-12-27 to 2025-12-29
Number of days: 3
Number of subnets with sales: 1
Total TAO sold by miners: 1,234.56 TAO
Average daily sales: 411.52 TAO
```

## Important Notes

### 1. Why "Miner Sales"?

The variable names use "sales" terminology, but technically these are **unstaking events**. The assumption is that when miners unstake TAO, they're preparing to sell it, hence "miner sales."

### 2. Current Miner List Limitation

The script only matches unstaking events to **current miners** in the subnet. This means:
- ✅ If a current miner has TAO unstaked from them, it's captured
- ❌ If a former miner (who left the subnet) has TAO unstaked from them, it's NOT captured

This is a known limitation based on the available API data.

### 3. Unstaking vs Removing Stake

In Bittensor terminology:
- **Staking/Delegation**: Locking TAO to support a hotkey
- **Unstaking/Undelegation**: Removing TAO from a hotkey (action: "undelegate")

This script only tracks **unstaking** (removals), not new staking.

### 4. Time Zones

All timestamps from the TaoStats API are in UTC. The script converts them to date objects, which drops the time component.

### 5. Subnet Filtering Performance

Processing all subnets takes significantly longer due to:
- API rate limiting (12 second delays)
- Multiple metagraph fetches
- Multiple delegation event queries

**Recommendation**: Use `SPECIFIC_SUBNETS` to target specific subnets of interest for faster execution.

## Error Handling

### API Errors

- **429 Rate Limit**: Automatic retry with exponential backoff
- **404 Not Found**: Falls back to alternative endpoint for metagraph
- **Timeout**: 30 second timeout per request
- **Max Retries**: 3 attempts before giving up

### Data Validation

- Skips events with missing required fields (hotkey, timestamp, amount)
- Handles both dict and string formats for addresses
- Logs warnings for unparseable amounts
- Returns empty DataFrames if no data found

## Data Flow Diagram

```
┌─────────────────┐
│  Configuration  │
│  SPECIFIC_SUBNETS│
│  DAYS_BACK      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Get All Subnets        │
│  (TaoStats API)         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Filter Subnets         │
│  (if SPECIFIC_SUBNETS)  │
└────────┬────────────────┘
         │
         ▼
    ┌────────────────────┐
    │  For Each Subnet:  │
    └────────┬───────────┘
             │
             ├──► Get Metagraph ──► Extract Miner Hotkeys
             │
             ├──► Get Unstaking Events (UNDELEGATE)
             │
             └──► Filter Events:
                  - Is delegate a miner?
                  - Has required fields?

                  ▼
            ┌─────────────────┐
            │  Extract Data:  │
            │  - date         │
            │  - netuid       │
            │  - tao_amount   │
            │  - hotkey       │
            │  - coldkey      │
            │  - extrinsic_id │
            └────────┬────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Raw Data CSV    │    │  Pivot Table     │
│  (transactions)  │    │  (date × subnet) │
└──────────────────┘    └──────────────────┘
```

## Troubleshooting

### No Data Found

**Possible causes**:
1. No unstaking events occurred in the time period
2. No current miners had unstaking events
3. API key is invalid
4. Selected subnets have no miners

**Solutions**:
- Increase `DAYS_BACK` to capture more history
- Try different subnets
- Verify API key is valid
- Check TaoStats API status

### Script Running Slowly

**Cause**: API rate limiting (12 second delays between requests)

**Solutions**:
- Reduce `DAYS_BACK`
- Use `SPECIFIC_SUBNETS` instead of processing all subnets
- This is expected behavior to respect API limits

### Coldkey Column Empty

**Cause**: API response doesn't include `nominator` field

**Check**: Look for "DEBUG - First event structure" log to see actual API response format

**Solution**: Update coldkey extraction logic based on actual API field names

## Code Maintenance Notes

### Key Classes and Methods

1. **MinerFlowTracker**: Main class containing all logic
   - `__init__`: Initialize with API key
   - `get_all_subnets()`: Fetch subnet list
   - `get_miner_hotkeys_for_subnet()`: Get miners for one subnet
   - `get_unstaking_events()`: Fetch unstaking events for one subnet
   - `process_subnet()`: Process all events for one subnet
   - `fetch_all_miner_sales()`: Main orchestration method
   - `create_pivot_table()`: Transform to date × subnet matrix

2. **main()**: Entry point
   - Initializes tracker
   - Calls fetch_all_miner_sales()
   - Saves output files
   - Prints summary statistics

### Dependencies

- `requests`: HTTP API calls
- `pandas`: Data manipulation and CSV output
- `python-dotenv`: Environment variable loading
- Standard library: `os`, `time`, `datetime`, `typing`, `logging`

### Environment Variables (Optional)

Can override defaults via `.env` file:
- `TAOSTATS_API_BASE`
- `TAOSTATS_SUBNETS_ENDPOINT`
- `TAOSTATS_METAGRAPH_ENDPOINT`
- `TAOSTATS_METAGRAPH_FALLBACK_ENDPOINT`
- `TAOSTATS_DELEGATION_ENDPOINT`
- `TAOSTATS_UNDELEGATE_ACTION`
- `TAOSTATS_MAX_RETRIES`
- `TAOSTATS_RETRY_BACKOFF_BASE`
- `TAOSTATS_RETRY_BACKOFF_MAX`
