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

export default function Markets() {
  const { account, signer, isConnected } = useWallet();
  const { contracts: contractAddresses } = useContracts();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketInfos, setMarketInfos] = useState<Record<string, MarketInfo>>({});
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));
  
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
    loadMarkets();
    loadBalance();
  }, [isConnected, signer, account, contractAddresses.stakeToken]);

  const loadBalance = async () => {
    if (!isConnected || !signer || !account || !contractAddresses.stakeToken) {
      setBalance(null);
      return;
    }

    try {
      const stakeToken = new ethers.Contract(contractAddresses.stakeToken, STAKE_TOKEN_ABI, signer);
      const bal = await stakeToken.balanceOf(account);
      setBalance(ethers.formatEther(bal));
    } catch (error) {
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
    setDepositing(marketAddress);
    try {
      const stakeToken = new ethers.Contract(contractAddresses.stakeToken, STAKE_TOKEN_ABI, signer);
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
      const amountWei = ethers.parseEther(amount);
      const userAddress = await signer.getAddress();

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
      
      // Approve if needed - use max approval to avoid repeated approvals
      if (currentAllowance < amountWei) {
        console.log(`  Approving tokens (using max approval for convenience)...`);
        const maxApproval = ethers.MaxUint256;
        const approveTx = await stakeToken.approve(marketAddress, maxApproval);
        const receipt = await approveTx.wait();
        console.log(`  ✅ Approval transaction confirmed: ${receipt.hash}`);
        
        // Verify approval went through
        currentAllowance = await stakeToken.allowance(userAddress, marketAddress);
        console.log(`  Verified allowance: ${ethers.formatEther(currentAllowance)} tokens`);
        
        if (currentAllowance < amountWei) {
          throw new Error('Approval failed. Please try again.');
        }
      } else {
        console.log(`  ✅ Already has sufficient allowance`);
      }

      // Double-check balance and allowance right before deposit
      const finalBalance = await stakeToken.balanceOf(userAddress);
      const finalAllowance = await stakeToken.allowance(userAddress, marketAddress);
      console.log(`  Final check - Balance: ${ethers.formatEther(finalBalance)}, Allowance: ${ethers.formatEther(finalAllowance)}`);
      
      if (finalBalance < amountWei) {
        throw new Error('Insufficient balance. Balance changed during transaction.');
      }
      if (finalAllowance < amountWei) {
        throw new Error('Insufficient allowance. Please approve again.');
      }

      // Deposit
      console.log(`  Depositing ${amount} tokens on outcome ${outcome}...`);
      const depositTx = await market.deposit(outcome, amountWei);
      await depositTx.wait();
      console.log(`  ✅ Deposit successful!`);

      alert('Deposit successful!');
      loadMarkets();
      loadBalance(); // Refresh balance after deposit
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
    if (!signer) return;
    try {
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
      const tx = await market.redeem();
      await tx.wait();
      alert('Redeemed successfully!');
      loadMarkets();
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
              <button onClick={() => redeem(market.marketAddress)}>Redeem</button>
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
          </div>
        );
      })}
    </div>
  );
}

