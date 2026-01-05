# Backend Reference Scripts

This directory contains reference implementations showing how miner flow data is currently collected.

## Scripts

### `miner_flows.py`
Fetches TAO unstaking events from miners across Bittensor subnets.

**Usage**:
```bash
python miner_flows.py
```

**Output**: CSV files with daily miner sales by subnet

**See**: `README_MINER_FLOWS.md` for complete documentation

### `miner_flow_blockchain.py`
Additional blockchain analysis scripts.

## API Integration

These scripts use the **TaoStats API**:
- Base URL: `https://api.taostats.io`
- API Key: (see `.env` file)

## Next Steps

Build production APIs matching the schemas in `../docs/DATA_REQUIREMENTS.md`
