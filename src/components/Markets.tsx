import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { CONFIG, MARKET_ABI, STAKE_TOKEN_ABI } from '../config';
import { useContracts } from '../hooks/useContracts';

interface Market {
  type: string;
  projectName?: string;
  projectA?: string;
  projectB?: string;
  marketAddress: string;
  marketId?: string;
  lockTime: number;
  resolveTime: number;
  phase?: number;
  status?: string;
}

interface MarketInfo {
  phase: number;
  pools: { A: bigint; B: bigint };
  winner: number;
  lockTime: bigint;
  resolveTime: bigint;
}

interface DepositInfo {
  user: string;
  outcome: number;
  amount: bigint;
  blockNumber: number;
}

interface UserInvestment {
  aClaims: bigint;
  bClaims: bigint;
  totalInvested: bigint;
  potentialPayout: bigint;
  isWinner: boolean;
  redeemed: boolean;
}

export default function Markets() {
  const { account, signer, isConnected } = useWallet();
  const { contracts: contractAddresses, loading: contractsLoading } = useContracts();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketInfos, setMarketInfos] = useState<Record<string, MarketInfo>>({});
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));
  const [marketDeposits, setMarketDeposits] = useState<Record<string, DepositInfo[]>>({});
  const [userInvestments, setUserInvestments] = useState<Record<string, UserInvestment>>({});
  const [loadingDeposits, setLoadingDeposits] = useState<Record<string, boolean>>({});
  
  const isAdmin = account && account.toLowerCase() === CONFIG.ADMIN_WALLET.toLowerCase();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Update current time every second for countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!contractsLoading) {
      loadMarkets();
      loadBalance();
    }
  }, [isConnected, signer, account, contractAddresses.stakeToken, contractsLoading]);


  // Reload user-specific data when account changes
  useEffect(() => {
    if (isConnected && account && signer) {
      loadBalance();
      // Reload user investments for all markets
      markets.forEach(market => {
        loadUserInvestment(market.marketAddress);
      });
    }
  }, [account, markets, isConnected, signer]); // Reload when account or markets change

  // Load deposits for a market
  const loadDeposits = async (marketAddress: string) => {
    if (!signer || loadingDeposits[marketAddress]) return;
    
    setLoadingDeposits(prev => ({ ...prev, [marketAddress]: true }));
    try {
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
      
      // Get current block number and query from a reasonable range
      // RPC providers limit queries to ~100k blocks, so we'll query from last 50k blocks
      const currentBlock = await signer.provider!.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000); // Query last 50k blocks
      
      console.log(`🔍 Querying Deposit events for market ${marketAddress}...`);
      console.log(`  Querying from block ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock} blocks)`);
      
      // Get Deposit events using queryFilter
      const filter = market.filters.Deposit();
      const events = await market.queryFilter(filter, fromBlock);
      console.log(`  Found ${events.length} Deposit events`);

      const deposits: DepositInfo[] = [];
      for (const event of events) {
        // Check if it's an EventLog with args
        if ('args' in event && event.args) {
          const args = event.args as any;
          const user = args.user || args[0];
          const outcome = Number(args.outcome || args[1]);
          const amount = args.amount || args[2];
          
          if (user && outcome && amount) {
            deposits.push({
              user: typeof user === 'string' ? user : user.toString(),
              outcome,
              amount: typeof amount === 'bigint' ? amount : BigInt(amount.toString()),
              blockNumber: event.blockNumber || 0,
            });
          } else {
            console.warn('⚠️  Invalid event args:', args);
          }
        } else {
          console.warn('⚠️  Event missing args:', event);
        }
      }

      console.log(`✅ Parsed ${deposits.length} deposits`);
      setMarketDeposits(prev => ({ ...prev, [marketAddress]: deposits }));
    } catch (error: any) {
      console.error('Error loading deposits:', error);
      alert(`Error loading deposits: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingDeposits(prev => ({ ...prev, [marketAddress]: false }));
    }
  };

  // Load user investment for a market
  const loadUserInvestment = async (marketAddress: string) => {
    if (!signer || !account) return;
    
    try {
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
      const [accountInfo, pools, winner] = await Promise.all([
        market.a(account) as Promise<[bigint, bigint, boolean]>,
        market.pools() as Promise<{ A: bigint; B: bigint } | [bigint, bigint]>,
        market.winner() as Promise<bigint | number>,
      ]);

      const aClaims = accountInfo[0];
      const bClaims = accountInfo[1];
      const redeemed = accountInfo[2];
      const totalInvested = aClaims + bClaims;

      // Normalize pools object (ethers v6 returns {A,B}, older returns array)
      const poolA = 'A' in pools ? pools.A : (pools as [bigint, bigint])[0];
      const poolB = 'B' in pools ? pools.B : (pools as [bigint, bigint])[1];
      const winnerNum = Number(winner);

      // Calculate potential payout if market is resolved
      let potentialPayout = BigInt(0);
      let isWinner = false;
      const gross = poolA + poolB;
      
      // Only calculate if market is resolved (winner > 0)
      if (winnerNum > 0) {
        if (winnerNum === 1) {
          // Winner is outcome 1
          if (aClaims > 0n) {
            isWinner = true;
            if (poolA > 0n) {
              potentialPayout = (aClaims * gross) / poolA;
            }
          }
        } else if (winnerNum === 2) {
          // Winner is outcome 2
          if (bClaims > 0n) {
            isWinner = true;
            if (poolB > 0n) {
              potentialPayout = (bClaims * gross) / poolB;
            }
          }
        }
      }

      setUserInvestments(prev => ({
        ...prev,
        [marketAddress]: {
          aClaims,
          bClaims,
          totalInvested,
          potentialPayout,
          isWinner,
          redeemed,
        },
      }));
    } catch (error) {
      console.error('Error loading user investment:', error);
    }
  };

  const loadBalance = async () => {
    if (!isConnected || !signer || !account || !contractAddresses.stakeToken || contractAddresses.stakeToken === '') {
      setBalance(null);
      return;
    }

    try {
      const stakeToken = new ethers.Contract(contractAddresses.stakeToken, STAKE_TOKEN_ABI, signer);
      if (!stakeToken || typeof stakeToken.balanceOf !== 'function') {
        console.error('Invalid contract instance - balanceOf is not a function');
        setBalance(null);
        return;
      }
      const bal = await stakeToken.balanceOf(account);
      setBalance(ethers.formatEther(bal));
    } catch (error: any) {
      console.error('Error loading balance:', error);
      setBalance(null);
    }
  };

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/markets`);
      const marketsList: Market[] = await response.json();
      console.log(`📊 Loaded ${marketsList.length} markets from API`);
      marketsList.forEach((m, i) => {
        const name = m.type === 'top10' ? m.projectName : `${m.projectA} vs ${m.projectB}`;
        console.log(`  ${i + 1}. ${m.type}: ${name} - ${m.marketAddress}`);
      });
      
      setMarkets(marketsList);

      const infos: Record<string, MarketInfo> = {};
      for (const market of marketsList) {
        infos[market.marketAddress] = {
          phase: market.phase ?? 0,
          pools: { A: BigInt(0), B: BigInt(0) },
          winner: 0,
          lockTime: BigInt(market.lockTime),
          resolveTime: BigInt(market.resolveTime),
        };
      }

      if (isConnected && signer) {
        for (const market of marketsList) {
          const marketName = market.type === 'top10' ? market.projectName : `${market.projectA} vs ${market.projectB}`;
          console.log(`🔍 Loading on-chain data for: ${marketName} (${market.marketAddress})`);
          
          try {
            // First check if contract has code
            const code = await signer.provider!.getCode(market.marketAddress);
            if (code === '0x' || code === '0x0') {
              console.warn(`⚠️  Market ${market.marketAddress} has no code - skipping on-chain data`);
              continue;
            }

            const contract = new ethers.Contract(market.marketAddress, MARKET_ABI, signer);
            const [phase, pools, winner, lockTime, resolveTime] = await Promise.all([
              contract.phase(),
              contract.pools(),
              contract.winner(),
              contract.lockTime(),
              contract.resolveTime(),
            ]);
            infos[market.marketAddress] = {
              phase: Number(phase),
              pools: { A: pools.A, B: pools.B },
              winner: Number(winner),
              lockTime,
              resolveTime,
            };

            // Load deposits and user investment
            loadDeposits(market.marketAddress);
            if (account) {
              loadUserInvestment(market.marketAddress);
            }
            console.log(`✅ ${marketName}: Phase=${Number(phase)}, Pool A=${ethers.formatEther(pools.A)}, Pool B=${ethers.formatEther(pools.B)}`);
          } catch (error: any) {
            console.error(`❌ Error loading market ${market.marketAddress} (${marketName}):`, error.message || error);
            // Keep the DB data, just skip on-chain updates
          }
        }
      }
      setMarketInfos(infos);
    } catch (error) {
      console.error('Error loading markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const deposit = async (marketAddress: string, outcome: 1 | 2, amount: string) => {
    if (!signer) return;
    
    // Get fresh account address to ensure we're using the current connected account
    const currentAccount = await signer.getAddress();
    if (account && account.toLowerCase() !== currentAccount.toLowerCase()) {
      console.warn(`⚠️  Account mismatch! UI shows ${account}, but signer is ${currentAccount}. Using current signer.`);
    }
    
    setDepositing(marketAddress);
    try {
      const stakeToken = new ethers.Contract(contractAddresses.stakeToken, STAKE_TOKEN_ABI, signer);
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
      const amountWei = ethers.parseEther(amount);
      const userAddress = currentAccount; // Use fresh address from signer

      // Pre-flight checks
      console.log(`🔍 Pre-flight checks for deposit:`);
      
      // Check balance
      const balance = await stakeToken.balanceOf(userAddress);
      console.log(`  Balance: ${ethers.formatEther(balance)} tokens`);
      if (balance < amountWei) {
        throw new Error(`Insufficient balance. You have ${ethers.formatEther(balance)} tokens, need ${amount}`);
      }

      // Verify market contract has code
      const marketCode = await signer.provider!.getCode(marketAddress);
      if (!marketCode || marketCode === '0x' || marketCode === '0x0') {
        throw new Error(`Market contract at ${marketAddress} does not exist or has no code. This might be an old/invalid market.`);
      }
      console.log(`  ✅ Market contract verified (has code)`);

      // Verify market's stake token matches
      const marketStakeToken = await market.stakeToken();
      if (marketStakeToken.toLowerCase() !== contractAddresses.stakeToken.toLowerCase()) {
        throw new Error(`Market stake token mismatch. Market expects ${marketStakeToken}, but we're using ${contractAddresses.stakeToken}`);
      }
      console.log(`  ✅ Market stake token verified: ${marketStakeToken}`);

      // Check market phase
      const phase = Number(await market.phase());
      console.log(`  Market phase: ${phase} (0=Trading, 1=Locked, 2=Resolved, 3=Cancelled)`);
      if (phase !== 0) {
        throw new Error(`Market is not in Trading phase. Current phase: ${phase}`);
      }

      // Check lockTime
      const lockTime = await market.lockTime();
      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      console.log(`  Lock time: ${lockTime}, Current time: ${currentTime}`);
      if (currentTime >= lockTime) {
        throw new Error(`Market is locked. Lock time has passed.`);
      }

      // Check current allowance
      let currentAllowance = await stakeToken.allowance(userAddress, marketAddress);
      console.log(`  Current allowance: ${ethers.formatEther(currentAllowance)} tokens`);
      
      let justApproved = false;
      
      // Approve if needed - use max approval to avoid repeated approvals
      if (currentAllowance < amountWei) {
        console.log(`  Approving tokens (using max approval for convenience)...`);
        console.log(`  ⏳ Waiting for MetaMask approval...`);
        const maxApproval = ethers.MaxUint256;
        
        // Send approval transaction - this will show MetaMask popup
        const approveTx = await stakeToken.approve(marketAddress, maxApproval);
        console.log(`  📝 Approval transaction sent: ${approveTx.hash}`);
        console.log(`  ⏳ Waiting for transaction confirmation...`);
        
        // Wait for transaction to be mined (this waits for user to approve AND transaction to confirm)
        const receipt = await approveTx.wait();
        console.log(`  ✅ Approval transaction confirmed in block ${receipt.blockNumber}`);
        justApproved = true;
      } else {
        console.log(`  ✅ Already has sufficient allowance`);
      }

      // Double-check balance and allowance right before deposit
      const finalBalance = await stakeToken.balanceOf(userAddress);
      console.log(`  Final check - Balance: ${ethers.formatEther(finalBalance)}`);
      
      if (finalBalance < amountWei) {
        throw new Error('Insufficient balance. Balance changed during transaction.');
      }
      
      // If we just approved, skip allowance check (RPC cache lag issue)
      // The deposit will fail if allowance isn't actually there, which is fine
      if (!justApproved) {
        const finalAllowance = await stakeToken.allowance(userAddress, marketAddress);
        console.log(`  Final check - Allowance: ${ethers.formatEther(finalAllowance)}`);
        if (finalAllowance < amountWei) {
          throw new Error('Insufficient allowance. Please approve again.');
        }
      } else {
        console.log(`  Skipping allowance check (just approved - RPC cache may lag)`);
      }

      // Deposit
      console.log(`  Depositing ${amount} tokens on outcome ${outcome}...`);
      const depositTx = await market.deposit(outcome, amountWei);
      await depositTx.wait();
      console.log(`  ✅ Deposit successful!`);

      alert('Deposit successful!');
      loadMarkets();
      loadBalance(); // Refresh balance after deposit
      loadDeposits(marketAddress); // Reload deposits list
      loadUserInvestment(marketAddress); // Reload user investment
    } catch (error: any) {
      console.error('Deposit error:', error);
      
      // Try to decode the error
      let errorMessage = error.message || error.reason || 'Unknown error';
      
      // Check for common error patterns
      if (error.data) {
        const errorData = error.data;
        // Common error selectors
        if (errorData.includes('0xfb8f41b2')) {
          errorMessage = 'Market is locked or not in Trading phase';
        } else if (errorData.includes('0x08c379a0')) {
          // Standard require error - try to decode
          errorMessage = 'Transaction reverted. Check market phase and lock time.';
        }
      }
      
      // Check for specific error messages
      if (error.message) {
        if (error.message.includes('locked')) {
          errorMessage = 'Market is locked. Cannot deposit after lock time.';
        } else if (error.message.includes('phase')) {
          errorMessage = 'Market is not in Trading phase.';
        } else if (error.message.includes('outcome')) {
          errorMessage = 'Invalid outcome. Must be 1 or 2.';
        } else if (error.message.includes('allowance') || error.message.includes('ERC20')) {
          errorMessage = 'Token approval failed. Please try again.';
        }
      }
      
      alert(`Deposit failed: ${errorMessage}`);
    } finally {
      setDepositing(null);
    }
  };

  const redeem = async (marketAddress: string) => {
    if (!signer || !account) return;
    try {
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
      
      // Fetch user's account info (claims)
      const accountInfo = await market.a(account) as [bigint, bigint, boolean];
      const aClaims = accountInfo[0];
      const bClaims = accountInfo[1];
      const totalInvested = aClaims + bClaims;
      
      // Fetch market state
      const pools = await market.pools() as [bigint, bigint];
      const winner = Number(await market.winner());
      
      // Calculate expected payout
      const poolsA = pools[0];
      const poolsB = pools[1];
      const gross = poolsA + poolsB;
      
      let expectedPayout = BigInt(0);
      let investedInWinner = BigInt(0);
      
      if (winner === 1) {
        investedInWinner = aClaims;
        if (poolsA > 0) {
          expectedPayout = (aClaims * gross) / poolsA;
        }
      } else if (winner === 2) {
        investedInWinner = bClaims;
        if (poolsB > 0) {
          expectedPayout = (bClaims * gross) / poolsB;
        }
      }
      
      // Show confirmation with details
      const investedStr = ethers.formatEther(totalInvested);
      const payoutStr = ethers.formatEther(expectedPayout);
      const investedInWinnerStr = ethers.formatEther(investedInWinner);
      
      const confirmMsg = `Redeem Details:\n\n` +
        `Total Invested: ${investedStr} tokens\n` +
        `Invested in Winner (Outcome ${winner}): ${investedInWinnerStr} tokens\n` +
        `Expected Payout: ${payoutStr} tokens\n\n` +
        `Proceed with redemption?`;
      
      if (!confirm(confirmMsg)) {
        return;
      }
      
      // Get balance before redeem
      const stakeToken = new ethers.Contract(contractAddresses.stakeToken, STAKE_TOKEN_ABI, signer);
      const balanceBefore = await stakeToken.balanceOf(account) as bigint;
      
      // Execute redeem
      const tx = await market.redeem();
      await tx.wait();
      
      // Get balance after redeem
      const balanceAfter = await stakeToken.balanceOf(account) as bigint;
      const actualPayout = balanceAfter - balanceBefore;
      
      // Show success with actual payout
      const actualPayoutStr = ethers.formatEther(actualPayout);
      const profitLoss = actualPayout - totalInvested;
      const profitLossStr = ethers.formatEther(profitLoss);
      
      // Format profit/loss more clearly
      let profitLossDisplay: string;
      if (profitLoss > 0) {
        profitLossDisplay = `Profit: +${profitLossStr} tokens`;
      } else if (profitLoss < 0) {
        profitLossDisplay = `Loss: ${profitLossStr} tokens`;
      } else {
        profitLossDisplay = `Break even: 0 tokens`;
      }
      
      alert(`✅ Redeemed successfully!\n\n` +
        `Total Invested: ${investedStr} tokens\n` +
        `Payout Received: ${actualPayoutStr} tokens\n` +
        `${profitLossDisplay}`);
      
      loadMarkets();
      loadBalance(); // Refresh balance
      
      // Reload user investment to update redeemed status
      await loadUserInvestment(marketAddress);
    } catch (error: any) {
      console.error('Redeem error:', error);
      alert(`Redeem failed: ${error.message || error.reason || 'Unknown error'}`);
    }
  };

  const closeMarket = async (marketAddress: string) => {
    if (!signer || !isAdmin) return;
    setClosing(marketAddress);
    try {
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
      
      // Check lockTime before attempting close
      const lockTime = Number(await market.lockTime());
      const block = await signer.provider!.getBlock('latest');
      const currentTime = block?.timestamp ?? Math.floor(Date.now() / 1000);
      
      if (currentTime < lockTime) {
        const waitSeconds = lockTime - currentTime;
        const waitHours = Math.floor(waitSeconds / 3600);
        const waitMinutes = Math.floor((waitSeconds % 3600) / 60);
        alert(`Cannot close yet. LockTime: ${new Date(lockTime * 1000).toLocaleString()}\nWait: ${waitHours}h ${waitMinutes}m`);
        setClosing(null);
        return;
      }
      
      const tx = await market.close();
      await tx.wait();
      console.log(`✅ Market closed: ${tx.hash}`);
      
      // Force backend to sync phases
      try {
        await fetch(`${API_BASE}/api/admin/sync-phases`, { method: 'POST' });
      } catch (e) {
        console.warn('Failed to sync phases:', e);
      }
      
      alert('Market closed successfully!');
      // Reload to sync with backend
      loadMarkets();
    } catch (error: any) {
      console.error('Close error:', error);
      let errorMsg = error.message || error.reason || 'Unknown error';
      if (errorMsg.includes('time') || errorMsg.includes('locked')) {
        errorMsg = `Close failed: lockTime has not been reached yet. ${errorMsg}`;
      }
      alert(`Close failed: ${errorMsg}`);
    } finally {
      setClosing(null);
    }
  };

  const settleMarket = async (marketAddress: string) => {
    if (!signer || !isAdmin) return;
    setSettling(marketAddress);
    try {
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
      const tx = await market.settle();
      await tx.wait();
      alert('Market settled successfully!');
      loadMarkets();
    } catch (error: any) {
      console.error('Settle error:', error);
      alert(`Settle failed: ${error.message || error.reason || 'Unknown error'}`);
    } finally {
      setSettling(null);
    }
  };

  const closeAllMarkets = async () => {
    if (!isAdmin) return;
    setClosingAll(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/close-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to close markets');
      }
      console.log('Close all results:', data.results);
      alert('Close all request completed. Check console for details.');
      loadMarkets();
    } catch (error: any) {
      console.error('Close-all error:', error);
      alert(`Close all failed: ${error.message || 'Unknown error'}`);
    } finally {
      setClosingAll(false);
    }
  };

  const getPhaseName = (phase: number) => {
    const phases = ['Trading', 'Locked', 'Resolved', 'Cancelled'];
    return phases[phase] || 'Unknown';
  };

  const formatTimeRemaining = (targetTime: number) => {
    const remaining = targetTime - currentTime;
    if (remaining <= 0) return 'Time expired';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  if (loading) return <div>Loading markets...</div>;

  const hasTradingMarkets = markets.some((market) => market.status === 'trading');
  const canInteract = isConnected && signer;

  return (
    <div>
      <h2>Markets</h2>
      {!canInteract && <div>Please connect your wallet to interact with markets.</div>}
      {isAdmin && (
        <div style={{ color: 'green', fontWeight: 'bold' }}>
          Admin Mode: You can close and settle markets
        </div>
      )}
      {isConnected && balance !== null && (
        <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
          <strong>Your Balance:</strong> {balance} tokens
          <button onClick={loadBalance} style={{ marginLeft: '10px', padding: '5px 10px' }}>Refresh</button>
        </div>
      )}
      <button onClick={loadMarkets}>Refresh Markets</button>
      {isAdmin && (
        <>
          <button 
            onClick={async () => {
              try {
                await fetch(`${API_BASE}/api/admin/sync-phases`, { method: 'POST' });
                loadMarkets();
                alert('Phases synced!');
              } catch (e) {
                alert('Failed to sync phases');
              }
            }}
            style={{ marginLeft: '10px' }}
          >
            Sync Phases
          </button>
        </>
      )}
      {isAdmin && hasTradingMarkets && (
        <button onClick={closeAllMarkets} disabled={closingAll || !canInteract} style={{ marginLeft: '10px' }}>
          {closingAll ? 'Closing all...' : 'Close All Markets (On-chain)'}
        </button>
      )}
      
      {markets.map((market) => {
        const info = marketInfos[market.marketAddress];
        if (!info) return null;

        const lockTimeNum = Number(info.lockTime);
        const resolveTimeNum = Number(info.resolveTime);

        return (
          <div key={market.marketAddress} style={{ border: '1px solid black', margin: '10px', padding: '10px' }}>
            <h3>
              {market.type === 'top10' 
                ? `Top-10: Will ${market.projectName} be in Top 10?`
                : `H2H: Who will rank higher - ${market.projectA} or ${market.projectB}?`}
            </h3>
            <div><strong>Status:</strong> {getPhaseName(info.phase)}</div>
            {info.phase === 0 && (
              <div><strong>Time until lock:</strong> {formatTimeRemaining(lockTimeNum)}</div>
            )}
            {info.phase === 1 && (
              <div><strong>Time until resolve:</strong> {formatTimeRemaining(resolveTimeNum)}</div>
            )}
            {market.type === 'top10' ? (
              <>
                <div><strong>Yes (Top 10):</strong> {ethers.formatEther(info.pools.A)} tokens</div>
                <div><strong>No (Not Top 10):</strong> {ethers.formatEther(info.pools.B)} tokens</div>
              </>
            ) : (
              <>
                <div><strong>{market.projectA}:</strong> {ethers.formatEther(info.pools.A)} tokens</div>
                <div><strong>{market.projectB}:</strong> {ethers.formatEther(info.pools.B)} tokens</div>
              </>
            )}
            {info.phase === 2 && (
              <div><strong>Winner:</strong> {info.winner === 1 ? (market.type === 'top10' ? 'Yes (Top 10)' : market.projectA) : (market.type === 'top10' ? 'No (Not Top 10)' : market.projectB)}</div>
            )}

            {/* User Investment Info */}
            {isConnected && account && userInvestments[market.marketAddress] && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '5px' }}>
                <strong>Your Investment:</strong>
                <div>Outcome 1: {ethers.formatEther(userInvestments[market.marketAddress].aClaims)} tokens</div>
                <div>Outcome 2: {ethers.formatEther(userInvestments[market.marketAddress].bClaims)} tokens</div>
                <div>Total: {ethers.formatEther(userInvestments[market.marketAddress].totalInvested)} tokens</div>
                {info.phase === 2 && (
                  <div>
                    {userInvestments[market.marketAddress].redeemed ? (
                      <div>
                        <strong>Status:</strong> <span style={{ color: 'green' }}>✅ Winner - Already Redeemed</span>
                      </div>
                    ) : userInvestments[market.marketAddress].isWinner ? (
                      <div>
                        <strong>Potential Payout:</strong> {ethers.formatEther(userInvestments[market.marketAddress].potentialPayout)} tokens
                        <span style={{ color: 'green' }}> ✅ Winner!</span>
                      </div>
                    ) : (
                      <div>
                        <strong>Status:</strong> <span style={{ color: 'red' }}>❌ Loser</span>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                          (No payout - you bet on the losing outcome)
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Deposits List */}
            <div style={{ marginTop: '10px' }}>
              <button 
                onClick={() => loadDeposits(market.marketAddress)}
                disabled={loadingDeposits[market.marketAddress]}
                style={{ padding: '5px 10px', marginBottom: '10px' }}
              >
                {loadingDeposits[market.marketAddress] ? 'Loading...' : 'Show All Bets'}
              </button>
              
              {marketDeposits[market.marketAddress] !== undefined && (
                marketDeposits[market.marketAddress].length > 0 ? (
                  <div style={{ marginTop: '10px', border: '1px solid #ccc', padding: '10px', borderRadius: '5px' }}>
                    <h4>All Bets:</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <strong>{market.type === 'top10' ? 'Yes (Top 10)' : market.projectA}:</strong>
                        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                          {marketDeposits[market.marketAddress]
                            .filter(d => d.outcome === 1)
                            .map((d, i) => (
                              <li key={i} style={{ fontSize: '12px' }}>
                                {d.user.slice(0, 6)}...{d.user.slice(-4)}: {ethers.formatEther(d.amount)} tokens
                                {info.phase === 2 && info.winner === 1 && <span style={{ color: 'green' }}> ✅ Winner</span>}
                              </li>
                            ))}
                        </ul>
                      </div>
                      <div>
                        <strong>{market.type === 'top10' ? 'No (Not Top 10)' : market.projectB}:</strong>
                        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                          {marketDeposits[market.marketAddress]
                            .filter(d => d.outcome === 2)
                            .map((d, i) => (
                              <li key={i} style={{ fontSize: '12px' }}>
                                {d.user.slice(0, 6)}...{d.user.slice(-4)}: {ethers.formatEther(d.amount)} tokens
                                {info.phase === 2 && info.winner === 2 && <span style={{ color: 'green' }}> ✅ Winner</span>}
                              </li>
                            ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '10px', padding: '10px', color: '#666', fontStyle: 'italic' }}>
                    No bets found for this market yet.
                  </div>
                )
              )}
            </div>
            
            {info.phase === 0 && canInteract && (
              <div style={{ marginTop: '10px' }}>
                <h4>Place Bet</h4>
                <input type="number" id={`amount-${market.marketAddress}`} placeholder="Amount" defaultValue="100" style={{ marginRight: '10px', padding: '5px' }} />
                {market.type === 'top10' ? (
                  <>
                    <button 
                      onClick={() => {
                        const amount = (document.getElementById(`amount-${market.marketAddress}`) as HTMLInputElement)?.value;
                        if (amount) deposit(market.marketAddress, 1, amount);
                      }}
                      disabled={depositing === market.marketAddress}
                      style={{ marginRight: '5px', padding: '8px 15px' }}
                    >
                      Yes (Top 10)
                    </button>
                    <button 
                      onClick={() => {
                        const amount = (document.getElementById(`amount-${market.marketAddress}`) as HTMLInputElement)?.value;
                        if (amount) deposit(market.marketAddress, 2, amount);
                      }}
                      disabled={depositing === market.marketAddress}
                      style={{ padding: '8px 15px' }}
                    >
                      No (Not Top 10)
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        const amount = (document.getElementById(`amount-${market.marketAddress}`) as HTMLInputElement)?.value;
                        if (amount) deposit(market.marketAddress, 1, amount);
                      }}
                      disabled={depositing === market.marketAddress}
                      style={{ marginRight: '5px', padding: '8px 15px' }}
                    >
                      {market.projectA}
                    </button>
                    <button 
                      onClick={() => {
                        const amount = (document.getElementById(`amount-${market.marketAddress}`) as HTMLInputElement)?.value;
                        if (amount) deposit(market.marketAddress, 2, amount);
                      }}
                      disabled={depositing === market.marketAddress}
                      style={{ padding: '8px 15px' }}
                    >
                      {market.projectB}
                    </button>
                  </>
                )}
              </div>
            )}

            {info.phase === 2 && canInteract && (
              <button 
                onClick={() => redeem(market.marketAddress)}
                disabled={userInvestments[market.marketAddress]?.redeemed === true}
              >
                {userInvestments[market.marketAddress]?.redeemed ? 'Already Redeemed' : 'Redeem'}
              </button>
            )}

            {isAdmin && canInteract && (
              <div style={{ marginTop: '10px', borderTop: '1px solid black', paddingTop: '10px', backgroundColor: '#fff3cd', borderRadius: '5px', padding: '10px' }}>
                <h4>Admin Actions</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {info.phase === 0 && (
                    <button 
                      onClick={() => closeMarket(market.marketAddress)}
                      disabled={closing === market.marketAddress}
                    >
                      {closing === market.marketAddress ? 'Closing...' : 'Close Market'}
                    </button>
                  )}
                  {info.phase === 1 && (
                    <button 
                      onClick={() => settleMarket(market.marketAddress)}
                      disabled={settling === market.marketAddress}
                    >
                      {settling === market.marketAddress ? 'Settling...' : 'Settle Market'}
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {isAdmin && (
              <div style={{ marginTop: '10px', borderTop: '1px solid black', paddingTop: '10px', backgroundColor: '#e7f3ff', borderRadius: '5px', padding: '10px' }}>
                <h4>Global Admin Actions</h4>
                <button 
                  onClick={async () => {
                    if (!confirm('Regenerate leaderboard? This will randomize today\'s leaderboard and create a new snapshot.')) {
                      return;
                    }
                    try {
                      const response = await fetch(`${API_BASE}/api/admin/regenerate-leaderboard`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                      });
                      const data = await response.json();
                      if (response.ok) {
                        alert(`✅ Leaderboard regenerated!\n\nNew snapshot index: ${data.index}\nTop 10: ${data.top10.join(', ')}`);
                      } else {
                        alert(`Error: ${data.error || 'Failed to regenerate leaderboard'}`);
                      }
                    } catch (error: any) {
                      alert(`Error: ${error.message || 'Failed to regenerate leaderboard'}`);
                    }
                  }}
                  style={{ padding: '8px 15px' }}
                >
                  Regenerate Leaderboard
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

