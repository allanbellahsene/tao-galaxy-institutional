"""
Bittensor Miner Flow Tracker
Fetches TAO sales by miners across all subnets for the last 30 days
Output: CSV with dates as rows, subnets as columns, TAO amounts as values
"""

import os
import requests
import pandas as pd
from datetime import datetime, timedelta
import time
from typing import Dict, List, Set, Optional, Union
import logging
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
load_dotenv()

TAOSTATS_API_KEY = "tao-05371483-542b-406c-92c0-ef1a4a0d2ef1:5d943abb"
BASE_URL = os.getenv("TAOSTATS_API_BASE", "https://api.taostats.io").rstrip("/")
SUBNETS_ENDPOINT = os.getenv("TAOSTATS_SUBNETS_ENDPOINT", "api/subnet/identity/v1")
METAGRAPH_ENDPOINT = os.getenv("TAOSTATS_METAGRAPH_ENDPOINT", "api/metagraph/latest/v1")
METAGRAPH_FALLBACK_ENDPOINT = os.getenv("TAOSTATS_METAGRAPH_FALLBACK_ENDPOINT", "api/metagraph/history/v1")
DELEGATION_ENDPOINT = os.getenv("TAOSTATS_DELEGATION_ENDPOINT", "api/delegation/v1")
UNDELEGATE_ACTION = os.getenv("TAOSTATS_UNDELEGATE_ACTION", "undelegate")
RATE_LIMIT_DELAY = 12
MAX_RETRIES = int(os.getenv("TAOSTATS_MAX_RETRIES", "3"))
RETRY_BACKOFF_BASE = float(os.getenv("TAOSTATS_RETRY_BACKOFF_BASE", "2"))
RETRY_BACKOFF_MAX = float(os.getenv("TAOSTATS_RETRY_BACKOFF_MAX", "30"))
DAYS_BACK = 30

# ========== SUBNET FILTER CONFIGURATION ==========
# Set SPECIFIC_SUBNETS to a list of subnet IDs to process only those subnets
# Set to None to process all subnets
SPECIFIC_SUBNETS = [64, 1, 2, 3, 4, 8, 9, 10, 51]  # Change to None for all subnets, or [1, 8, 35] for specific ones
# ==================================================

class MinerFlowTracker:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.rate_limit_delay = RATE_LIMIT_DELAY
        self.headers = {
            "accept": "application/json",
            "Authorization": api_key,
            "Content-Type": "application/json"
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def _make_request(
        self,
        endpoint: Union[str, List[str]],
        params: dict = None
    ) -> Optional[dict]:
        """Make API request with error handling and rate limiting"""
        endpoints = [endpoint] if isinstance(endpoint, str) else endpoint
        params = params or {}

        for idx, path in enumerate(endpoints):
            normalized_path = path.lstrip("/")
            if BASE_URL.endswith("/api") and normalized_path.startswith("api/"):
                normalized_path = normalized_path[len("api/"):]
            url = f"{BASE_URL}/{normalized_path}"

            try:
                for attempt in range(MAX_RETRIES):
                    response = self.session.get(url, params=params, timeout=30)

                    if response.status_code == 429:
                        retry_after = response.headers.get("Retry-After")
                        if retry_after and retry_after.isdigit():
                            delay = min(int(retry_after), RETRY_BACKOFF_MAX)
                        else:
                            delay = min(RETRY_BACKOFF_BASE ** attempt, RETRY_BACKOFF_MAX)
                        logger.warning(
                            f"Rate limited (429) for {path}. Retrying in {delay:.1f}s..."
                        )
                        time.sleep(delay)
                        continue

                    if response.status_code == 404 and idx < len(endpoints) - 1:
                        logger.warning(f"Endpoint not found ({path}), trying fallback...")
                        break

                    if response.status_code >= 400:
                        try:
                            error_detail = response.json()
                            logger.error(f"API error {response.status_code} for {path}: {error_detail}")
                        except:
                            logger.error(f"API error {response.status_code} for {path}: {response.text[:200]}")

                    response.raise_for_status()

                    # Respect rate limits
                    time.sleep(self.rate_limit_delay)

                    return response.json()

                continue

            except requests.exceptions.RequestException as e:
                logger.error(f"API request failed for {path}: {e}")
                return None

        return None

    @staticmethod
    def _extract_data_list(payload: Optional[dict]) -> List[Dict]:
        if payload is None:
            return []
        if isinstance(payload, dict):
            data = payload.get("data")
            if isinstance(data, list):
                return data
        if isinstance(payload, list):
            return payload
        return []
    
    def get_all_subnets(self) -> List[Dict]:
        """Fetch all active subnets"""
        logger.info("Fetching all subnets...")
        
        data = self._make_request([SUBNETS_ENDPOINT, "api/v2/subnets"])
        subnets = self._extract_data_list(data)

        if subnets:
            logger.info(f"Found {len(subnets)} subnets")
            return subnets
        
        logger.error("Failed to fetch subnets")
        return []
    
    def get_miner_hotkeys_for_subnet(self, netuid: int) -> Set[str]:
        """Get all miner hotkeys for a subnet (exclude validators)"""
        logger.info(f"Fetching miners for subnet {netuid}...")

        params = {"netuid": netuid}
        data = self._make_request(
            [METAGRAPH_ENDPOINT, METAGRAPH_FALLBACK_ENDPOINT],
            params=params
        )
        neurons = self._extract_data_list(data)

        if not neurons:
            logger.warning(f"Could not fetch metagraph for subnet {netuid}")
            return set()

        # Filter for miners (no validator permit)
        miners = set()
        for neuron in neurons:
            hotkey = neuron.get('hotkey')

            # Handle case where hotkey might be a dict or other non-string type
            if hotkey:
                if isinstance(hotkey, dict):
                    # If hotkey is a dict, extract ss58 address (Bittensor standard format)
                    hotkey = hotkey.get('ss58') or hotkey.get('hex')
                    if not hotkey:
                        logger.warning(f"Hotkey is dict with unexpected structure: {neuron.get('hotkey')}")
                        continue

                if not isinstance(hotkey, str):
                    logger.warning(f"Hotkey is not a string (type: {type(hotkey)}): {hotkey}")
                    continue

                # Check if it's a miner (not a validator)
                if not neuron.get('validator_permit', neuron.get('is_validator', False)):
                    miners.add(hotkey)

        logger.info(f"Found {len(miners)} miners in subnet {netuid}")
        return miners
    
    def get_unstaking_events(
        self,
        netuid: int,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """Get all unstaking events for a subnet in date range (with pagination)"""
        logger.info(f"Fetching unstaking events for subnet {netuid}...")

        all_events = []
        page = 1
        limit = 200  # Max allowed per page

        while True:
            params = {
                "netuid": netuid,
                "action": UNDELEGATE_ACTION,
                "timestamp_start": int(start_date.timestamp()),
                "timestamp_end": int(end_date.timestamp()),
                "limit": limit,
                "page": page
            }

            data = self._make_request(DELEGATION_ENDPOINT, params=params)
            events = self._extract_data_list(data)

            if not events:
                # No more events, we've reached the end
                break

            all_events.extend(events)
            logger.info(f"Page {page}: Fetched {len(events)} events (total so far: {len(all_events)})")

            # If we got fewer than the limit, this is the last page
            if len(events) < limit:
                break

            page += 1

        if all_events:
            logger.info(f"Found {len(all_events)} total unstaking events for subnet {netuid}")
            return all_events

        logger.warning(f"No unstaking events found for subnet {netuid}")
        return []
    
    def process_subnet(
        self, 
        netuid: int, 
        start_date: datetime, 
        end_date: datetime
    ) -> pd.DataFrame:
        """Process all miner sales for a specific subnet"""
        
        # Get miners for this subnet
        miners = self.get_miner_hotkeys_for_subnet(netuid)
        
        if not miners:
            logger.warning(f"No miners found for subnet {netuid}")
            return pd.DataFrame()
        
        # Get unstaking events
        events = self.get_unstaking_events(netuid, start_date, end_date)
        
        if not events:
            return pd.DataFrame()
        
        # Filter for miner events only and extract data
        miner_sales = []

        for event in events:
            # Extract delegate (validator/miner hotkey) from the event
            delegate = event.get('delegate')

            # Handle case where delegate might be a dict
            if delegate:
                if isinstance(delegate, dict):
                    # Extract ss58 address (Bittensor standard format)
                    hotkey = delegate.get('ss58') or delegate.get('hex')
                    if not hotkey:
                        continue
                elif isinstance(delegate, str):
                    hotkey = delegate
                else:
                    continue
            else:
                continue

            # Extract nominator (coldkey/owner) from the event
            nominator = event.get('nominator')
            coldkey = None
            if nominator:
                if isinstance(nominator, dict):
                    coldkey = nominator.get('ss58') or nominator.get('hex')
                elif isinstance(nominator, str):
                    coldkey = nominator

            timestamp = event.get('timestamp')
            raw_amount = event.get('amount')
            extrinsic = event.get("extrinsic_id")

            if not hotkey or not timestamp or raw_amount is None:
                continue

            # Only include if this delegate is a miner
            if hotkey in miners:
                try:
                    # Convert amount from RAO to TAO (amount is a string in the API)
                    tao_amount = float(raw_amount) / 1e9
                    miner_sales.append({
                        'date': pd.to_datetime(timestamp).date(),
                        'netuid': netuid,
                        'tao_amount': tao_amount,
                        'hotkey': hotkey,
                        'coldkey': coldkey,  # Add coldkey/owner address
                        'extrinsic_id': extrinsic
                    })
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to process event amount: {e}")
                    continue
        
        if miner_sales:
            df = pd.DataFrame(miner_sales)
            logger.info(f"Processed {len(miner_sales)} miner sales for subnet {netuid}")
            return df
        
        return pd.DataFrame()
    
    def fetch_all_miner_sales(self, days_back: int = 30, subnet_ids: Optional[List[int]] = None) -> pd.DataFrame:
        """Fetch miner sales across all or specific subnets for specified time period

        Args:
            days_back: Number of days to look back
            subnet_ids: Optional list of specific subnet IDs to process. If None, processes all subnets.
        """

        # Set date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)

        logger.info(f"Fetching miner sales from {start_date.date()} to {end_date.date()}")

        # Get all subnets
        subnets = self.get_all_subnets()

        if not subnets:
            logger.error("No subnets found. Exiting.")
            return pd.DataFrame()

        # Filter subnets if specific ones requested
        if subnet_ids is not None:
            subnets = [s for s in subnets if s['netuid'] in subnet_ids]
            logger.info(f"Filtering to {len(subnets)} specific subnets: {subnet_ids}")

            if not subnets:
                logger.error(f"None of the requested subnet IDs {subnet_ids} were found")
                return pd.DataFrame()

        # Process each subnet
        all_sales = []

        for subnet in subnets:
            netuid = subnet['netuid']
            print(netuid)
            subnet_name = subnet.get('subnet_name') or subnet.get('name') or f'SN{netuid}'
            
            logger.info(f"\n{'='*60}")
            logger.info(f"Processing {subnet_name} (netuid: {netuid})")
            logger.info(f"{'='*60}")
            
            try:
                subnet_df = self.process_subnet(netuid, start_date, end_date)
                
                if not subnet_df.empty:
                    subnet_df['subnet_name'] = subnet_name
                    all_sales.append(subnet_df)
                else:
                    logger.info(f"No miner sales found for {subnet_name}")
            
            except Exception as e:
                logger.error(f"Error processing subnet {netuid}: {e}")
                continue
        
        # Combine all subnet data
        if all_sales:
            combined_df = pd.concat(all_sales, ignore_index=True)
            logger.info(f"\nTotal miner sales records: {len(combined_df)}")
            return combined_df
        
        logger.warning("No sales data found for any subnet")
        return pd.DataFrame()
    
    def create_pivot_table(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create pivot table: dates as rows, subnets as columns"""
        
        if df.empty:
            logger.error("Cannot create pivot table from empty DataFrame")
            return pd.DataFrame()
        
        # Aggregate by date and subnet
        aggregated = df.groupby(['date', 'netuid', 'subnet_name']).agg({
            'tao_amount': 'sum'
        }).reset_index()
        
        # Create pivot table
        pivot = aggregated.pivot_table(
            index='date',
            columns='subnet_name',
            values='tao_amount',
            fill_value=0,
            aggfunc='sum'
        )
        
        # Sort by date
        pivot = pivot.sort_index()
        
        # Add total column
        pivot['TOTAL_ALL_SUBNETS'] = pivot.sum(axis=1)
        
        logger.info(f"\nPivot table created: {len(pivot)} days x {len(pivot.columns)} subnets")
        
        return pivot


def main():
    """Main execution function"""

    print("\n" + "="*80)
    print("BITTENSOR MINER FLOW TRACKER")
    print("="*80)

    if SPECIFIC_SUBNETS is not None:
        print(f"⚠️  FILTERING TO SPECIFIC SUBNETS: {SPECIFIC_SUBNETS}")
    else:
        print("Processing ALL subnets")

    print(f"Days back: {DAYS_BACK}")
    print("="*80 + "\n")

    # Initialize tracker
    tracker = MinerFlowTracker(api_key=TAOSTATS_API_KEY)

    # Fetch data
    print("Step 1: Fetching miner sales data...")
    raw_data = tracker.fetch_all_miner_sales(days_back=DAYS_BACK, subnet_ids=SPECIFIC_SUBNETS)
    
    if raw_data.empty:
        print("\n❌ No data found. Please check:")
        print("  1. Your API key is correct")
        print("  2. TaoStats API is accessible")
        print("  3. The endpoint paths are current")
        return
    
    # Save raw data
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    subnet_suffix = f"_subnets_{'_'.join(map(str, SPECIFIC_SUBNETS))}" if SPECIFIC_SUBNETS else "_all_subnets"
    raw_filename = f"miner_sales_raw{subnet_suffix}_{timestamp}.csv"
    raw_data.to_csv(raw_filename, index=False)
    print(f"\n✓ Raw data saved: {raw_filename}")

    # Create pivot table
    print("\nStep 2: Creating pivot table...")
    pivot_table = tracker.create_pivot_table(raw_data)

    if pivot_table.empty:
        print("❌ Failed to create pivot table")
        return

    # Save pivot table
    pivot_filename = f"miner_sales_by_subnet{subnet_suffix}_{timestamp}.csv"
    pivot_table.to_csv(pivot_filename)
    print(f"✓ Pivot table saved: {pivot_filename}")
    
    # Display summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Date range: {pivot_table.index.min()} to {pivot_table.index.max()}")
    print(f"Number of days: {len(pivot_table)}")
    print(f"Number of subnets with sales: {len(pivot_table.columns) - 1}")  # -1 for TOTAL column
    print(f"Total TAO sold by miners: {pivot_table['TOTAL_ALL_SUBNETS'].sum():,.2f} TAO")
    print(f"Average daily sales: {pivot_table['TOTAL_ALL_SUBNETS'].mean():,.2f} TAO")
    
    # Top 5 subnets by total sales
    print("\nTop 5 Subnets by Total Miner Sales:")
    subnet_totals = pivot_table.drop('TOTAL_ALL_SUBNETS', axis=1).sum().sort_values(ascending=False)
    for i, (subnet, total) in enumerate(subnet_totals.head(5).items(), 1):
        print(f"  {i}. {subnet}: {total:,.2f} TAO")
    
    # Preview table
    print("\nPreview of pivot table (first 5 days, first 5 subnets):")
    print(pivot_table.iloc[:5, :5].to_string())
    
    print("\n" + "="*80)
    print(f"✓ COMPLETE - Output files:")
    print(f"  • {raw_filename} (detailed transactions)")
    print(f"  • {pivot_filename} (date x subnet matrix)")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
