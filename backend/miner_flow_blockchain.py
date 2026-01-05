"""
Bittensor Miner Flow Tracker - Direct Blockchain Querying
Extracts TAO sales by miners across all subnets for the last 30 days
Bypasses TaoStats API - queries blockchain directly
"""

import bittensor as bt
from datetime import datetime, timedelta
import pandas as pd
import time
from typing import Dict, List, Set
import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG to see event extraction details
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DAYS_BACK = 1  # Reduced for testing - change back to 30 for full run
BLOCKS_PER_DAY = 7200  # ~12 second block time
BATCH_SIZE = 200  # Process blocks in batches for efficiency (increased for faster testing)


class BlockchainMinerFlowTracker:
    def __init__(self, network="finney"):
        """Initialize connection to Bittensor blockchain"""
        logger.info(f"Connecting to {network} network...")
        self.subtensor = bt.Subtensor(network=network)
        
        # Access the underlying substrate interface
        self.substrate = self.subtensor.substrate
        
        # Cache for miner identification
        self.subnet_miners_cache = {}
        
        logger.info("✓ Connected to blockchain")
    
    def get_miners_for_subnet(self, netuid: int, block: int = None) -> Set[str]:
        """Get all miner hotkeys for a subnet (exclude validators)"""
        
        cache_key = f"{netuid}_{block}" if block else f"{netuid}_current"
        if cache_key in self.subnet_miners_cache:
            return self.subnet_miners_cache[cache_key]
        
        try:
            metagraph = self.subtensor.metagraph(netuid, block=block)
            
            miners = set()
            for uid in range(metagraph.n.item()):
                # Check if NOT a validator
                if not metagraph.validator_permit[uid]:
                    hotkey = metagraph.hotkeys[uid]
                    miners.add(hotkey)
            
            self.subnet_miners_cache[cache_key] = miners
            logger.info(f"  Subnet {netuid}: {len(miners)} miners identified")
            return miners
        
        except Exception as e:
            logger.error(f"Error getting miners for subnet {netuid}: {e}")
            return set()
    
    def get_all_subnet_ids(self) -> List[int]:
        """Get all active subnet IDs"""
        try:
            # Get all netuids
            netuids = []
            netuid = 0
            while True:
                try:
                    if self.subtensor.subnet_exists(netuid):
                        netuids.append(netuid)
                    netuid += 1
                    if netuid > 100:  # Safety limit
                        break
                except:
                    break
            
            logger.info(f"Found {len(netuids)} active subnets")
            return netuids
        
        except Exception as e:
            logger.error(f"Error getting subnet IDs: {e}")
            return []
    
    def extract_stakeremoved_events(self, block_hash: str) -> List[Dict]:
        """Extract StakeRemoved events from a block"""
        try:
            # Query events from the block using substrate interface
            events = self.substrate.query(
                module='System',
                storage_function='Events',
                block_hash=block_hash
            )
            
            stake_removed_events = []
            
            if events:
                for event_record in events:
                    event = event_record['event']
                    
                    # Check if this is a StakeRemoved event from SubtensorModule
                    if (event['event_module'] == 'SubtensorModule' and 
                        event['event_id'] == 'StakeRemoved'):
                        
                        # Extract event parameters
                        # StakeRemoved(AccountId, u64) = (hotkey, amount_in_rao)
                        params = event['attributes']
                        
                        stake_removed_events.append({
                            'hotkey': params[0],  # AccountId (hotkey)
                            'amount_rao': int(params[1])  # u64 (amount in RAO)
                        })
            
            return stake_removed_events
        
        except Exception as e:
            logger.debug(f"Error extracting events from block {block_hash[:10]}...: {e}")
            return []

    def process_single_block(
        self,
        block_num: int,
        current_block: int,
        subnet_miners: Dict[int, Set[str]]
    ) -> List[Dict]:
        """Process a single block and extract miner sales (for parallel execution)"""
        try:
            # Get block hash
            block_hash = self.subtensor.get_block_hash(block_num)

            # Extract StakeRemoved events
            events = self.extract_stakeremoved_events(block_hash)

            if not events:
                return []

            # DEBUG: Log when events are found
            logger.info(f"Block {block_num}: Found {len(events)} StakeRemoved events")

            # Calculate approximate timestamp from block number
            # Bittensor has ~12 second block time (±30 sec accuracy)
            blocks_ago = current_block - block_num
            date = (datetime.now() - timedelta(seconds=blocks_ago * 12)).date()

            # Match events to miners and subnets
            miner_sales = []
            unmatched_events = []
            for event in events:
                hotkey = event['hotkey']
                tao_amount = event['amount_rao'] / 1e9  # Convert RAO to TAO

                # Find which subnet this miner belongs to
                matched = False
                for netuid, miners in subnet_miners.items():
                    if hotkey in miners:
                        miner_sales.append({
                            'date': date,
                            'netuid': netuid,
                            'hotkey': hotkey,
                            'tao_amount': tao_amount,
                            'block': block_num
                        })
                        matched = True
                        break  # Miner found in this subnet

                if not matched:
                    unmatched_events.append({'hotkey': hotkey, 'tao': tao_amount})

            # DEBUG: Log unmatched events
            if unmatched_events:
                logger.warning(f"Block {block_num}: {len(unmatched_events)} events not matched to current miners")
                logger.debug(f"Unmatched events: {unmatched_events[:3]}")  # Show first 3

            return miner_sales

        except Exception as e:
            logger.debug(f"Error processing block {block_num}: {e}")
            return []

    def process_blocks_batch(
        self,
        start_block: int,
        end_block: int,
        subnet_miners: Dict[int, Set[str]]
    ) -> List[Dict]:
        """Process a batch of blocks and extract miner sales (using parallel processing)"""

        # Get current block once for timestamp calculations (optimization)
        current_block = self.subtensor.get_current_block()

        # Prepare block numbers to process
        block_numbers = list(range(start_block, min(end_block, start_block + BATCH_SIZE)))

        # Process blocks in parallel using ThreadPoolExecutor
        miner_sales = []
        with ThreadPoolExecutor(max_workers=15) as executor:
            # Submit all block processing tasks
            future_to_block = {
                executor.submit(self.process_single_block, block_num, current_block, subnet_miners): block_num
                for block_num in block_numbers
            }

            # Collect results as they complete
            for future in as_completed(future_to_block):
                block_sales = future.result()
                if block_sales:
                    miner_sales.extend(block_sales)

        return miner_sales
    
    def fetch_miner_sales(self, days_back: int = 30, subnet_ids: List[int] = None) -> pd.DataFrame:
        """Main function to fetch all miner sales

        Args:
            days_back: Number of days to scan back
            subnet_ids: List of specific subnet IDs to process. If None, processes all subnets.
        """

        # Calculate block range
        current_block = self.subtensor.get_current_block()
        blocks_to_scan = BLOCKS_PER_DAY * days_back
        start_block = current_block - blocks_to_scan

        logger.info(f"\n{'='*80}")
        logger.info(f"SCANNING BLOCKCHAIN")
        logger.info(f"{'='*80}")
        logger.info(f"Current block: {current_block:,}")
        logger.info(f"Start block: {start_block:,}")
        logger.info(f"Blocks to scan: {blocks_to_scan:,}")
        logger.info(f"Estimated time: ~{blocks_to_scan / BATCH_SIZE / 60:.0f} minutes")

        # Get subnet IDs to process
        if subnet_ids is None:
            subnet_ids = self.get_all_subnet_ids()
        else:
            logger.info(f"Processing specific subnets: {subnet_ids}")

        # Get miners for each subnet
        logger.info(f"\nIdentifying miners across {len(subnet_ids)} subnets...")
        subnet_miners = {}
        for netuid in subnet_ids:
            miners = self.get_miners_for_subnet(netuid)
            if miners:
                subnet_miners[netuid] = miners
        
        logger.info(f"✓ Total miners identified: {sum(len(m) for m in subnet_miners.values())}")
        
        # Process blocks in batches
        all_sales = []
        total_batches = (blocks_to_scan + BATCH_SIZE - 1) // BATCH_SIZE
        
        logger.info(f"\nProcessing {total_batches} batches of {BATCH_SIZE} blocks...")
        
        for batch_idx in range(total_batches):
            batch_start = start_block + (batch_idx * BATCH_SIZE)
            batch_end = min(batch_start + BATCH_SIZE, current_block)
            
            logger.info(f"Batch {batch_idx + 1}/{total_batches}: Blocks {batch_start:,} to {batch_end:,}")
            
            batch_sales = self.process_blocks_batch(
                batch_start,
                batch_end,
                subnet_miners
            )
            
            all_sales.extend(batch_sales)
            
            if batch_sales:
                logger.info(f"  ✓ Found {len(batch_sales)} miner sales in this batch")
            
            # Progress update every 10 batches
            if (batch_idx + 1) % 10 == 0:
                logger.info(f"Progress: {((batch_idx + 1) / total_batches * 100):.1f}% complete")
                logger.info(f"Total sales found so far: {len(all_sales)}")
            
            # Small delay to avoid overwhelming the node
            time.sleep(0.1)
        
        # Convert to DataFrame
        if all_sales:
            df = pd.DataFrame(all_sales)
            logger.info(f"\n✓ Extraction complete: {len(df)} total miner sales")
            return df
        else:
            logger.warning("No miner sales found")
            return pd.DataFrame()
    
    def create_pivot_table(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create pivot table: dates as rows, subnets as columns"""
        
        if df.empty:
            logger.error("Cannot create pivot table from empty DataFrame")
            return pd.DataFrame()
        
        # Get subnet names
        subnet_names = {}
        for netuid in df['netuid'].unique():
            try:
                # Try to get subnet name
                subnet_info = self.subtensor.subnet(netuid)
                subnet_names[netuid] = f"SN{netuid}_{subnet_info.name}" if subnet_info.name else f"SN{netuid}"
            except:
                subnet_names[netuid] = f"SN{netuid}"
        
        df['subnet_name'] = df['netuid'].map(subnet_names)
        
        # Aggregate by date and subnet
        aggregated = df.groupby(['date', 'subnet_name']).agg({
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
        
        logger.info(f"✓ Pivot table created: {len(pivot)} days × {len(pivot.columns)} columns")
        
        return pivot


def main():
    """Main execution"""

    # ========== TEST MODE CONFIGURATION ==========
    # Set TEST_MODE = True to run on limited data for testing
    # Set TEST_MODE = False for full production run
    TEST_MODE = True

    if TEST_MODE:
        # Test configuration: only 3 subnets, 3 days
        test_days = 1
        test_subnets = [64,8]  # Change these to any subnet IDs you want to test
        print("\n" + "="*80)
        print("⚠️  RUNNING IN TEST MODE")
        print("="*80)
        print(f"Days: {test_days}")
        print(f"Subnets: {test_subnets}")
        print("Set TEST_MODE = False in the code for full production run")
        print("="*80 + "\n")
    else:
        # Full production configuration
        test_days = DAYS_BACK
        test_subnets = None  # None = all subnets
        print("\n" + "="*80)
        print("BITTENSOR MINER FLOW TRACKER - DIRECT BLOCKCHAIN QUERY")
        print("="*80 + "\n")
    # =============================================

    # Initialize tracker
    tracker = BlockchainMinerFlowTracker(network="finney")

    # Fetch data
    print("Starting blockchain extraction...")
    if TEST_MODE:
        print(f"This should take approximately {test_days * 7200 / 200 / 60:.1f} minutes\n")
    else:
        print("This will take approximately 30-60 minutes for 30 days of data\n")

    start_time = time.time()

    raw_data = tracker.fetch_miner_sales(days_back=test_days, subnet_ids=test_subnets)
    
    if raw_data.empty:
        print("\n❌ No data extracted. Check logs for errors.")
        return
    
    # Save raw data
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    mode_suffix = "_TEST" if TEST_MODE else ""
    raw_filename = f"miner_sales_blockchain_raw{mode_suffix}_{timestamp}.csv"
    raw_data.to_csv(raw_filename, index=False)
    print(f"\n✓ Raw data saved: {raw_filename}")

    # Create pivot table
    print("\nCreating pivot table...")
    pivot_table = tracker.create_pivot_table(raw_data)

    if pivot_table.empty:
        print("❌ Failed to create pivot table")
        return

    # Save pivot table
    pivot_filename = f"miner_sales_blockchain_pivot{mode_suffix}_{timestamp}.csv"
    pivot_table.to_csv(pivot_filename)
    print(f"✓ Pivot table saved: {pivot_filename}")
    
    elapsed_time = time.time() - start_time
    
    # Display summary
    print("\n" + "="*80)
    print("EXTRACTION COMPLETE")
    print("="*80)
    print(f"Execution time: {elapsed_time / 60:.1f} minutes")
    print(f"Date range: {pivot_table.index.min()} to {pivot_table.index.max()}")
    print(f"Number of days: {len(pivot_table)}")
    print(f"Subnets with sales: {len(pivot_table.columns) - 1}")
    print(f"Total TAO sold by miners: {pivot_table['TOTAL_ALL_SUBNETS'].sum():,.2f} TAO")
    print(f"Average daily sales: {pivot_table['TOTAL_ALL_SUBNETS'].mean():,.2f} TAO")
    
    # Top 5 subnets
    print("\nTop 5 Subnets by Total Miner Sales:")
    subnet_totals = pivot_table.drop('TOTAL_ALL_SUBNETS', axis=1).sum().sort_values(ascending=False)
    for i, (subnet, total) in enumerate(subnet_totals.head(5).items(), 1):
        print(f"  {i}. {subnet}: {total:,.2f} TAO")
    
    print("\n" + "="*80)
    print(f"✓ Output files:")
    print(f"  • {raw_filename}")
    print(f"  • {pivot_filename}")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()