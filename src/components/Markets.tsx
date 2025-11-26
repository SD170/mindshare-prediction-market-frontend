import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { CONFIG, MARKET_ABI, STAKE_TOKEN_ABI } from '../config';
import { useContracts } from '../hooks/useContracts';
import { useModal } from '../hooks/useModal';
import { ModalManager } from './ModalManager';
import type { Market, MarketInfo, DepositInfo, UserInvestment } from '../types/market';

export default function Markets() {
  const { account, signer, isConnected } = useWallet();
  const { contracts: contractAddresses, loading: contractsLoading } = useContracts();
  const { modal, showSuccess, showError, showLoading, showConfirm, hideModal } = useModal();
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
  const [expandedDeposits, setExpandedDeposits] = useState<Record<string, boolean>>({});
  const marketsRef = useRef<HTMLDivElement>(null);
  
  const isAdmin = account && account.toLowerCase() === CONFIG.ADMIN_WALLET.toLowerCase();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const ENABLE_CACHE = import.meta.env.VITE_ENABLE_CACHE === 'true';

  // Helper to update cache after on-chain writes
  const updateCache = async (marketAddress: string, userAddress?: string) => {
    if (!ENABLE_CACHE) return;
    try {
      await fetch(`${API_BASE}/api/cache/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketAddress, userAddress }),
      });
    } catch (error) {
      console.error('Cache update failed:', error);
    }
  };

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

      // Sort deposits by block number (most recent first)
      deposits.sort((a, b) => b.blockNumber - a.blockNumber);
      
      console.log(`✅ Parsed ${deposits.length} deposits`);
      setMarketDeposits(prev => ({ ...prev, [marketAddress]: deposits }));
    } catch (error: any) {
      console.error('Error loading deposits:', error);
      showError(`Error loading deposits: ${error.message || 'Unknown error'}`, 'Error');
    } finally {
      setLoadingDeposits(prev => ({ ...prev, [marketAddress]: false }));
    }
  };

  // Load user investment for a market
  const loadUserInvestment = async (marketAddress: string) => {
    if (!signer || !account) return;
    
    try {
      let accountInfo: [bigint, bigint, boolean];
      let pools: { A: bigint; B: bigint } | [bigint, bigint];
      let winner: bigint | number;

      if (ENABLE_CACHE) {
        // Fetch from API cache
        const [userRes, marketRes] = await Promise.all([
          fetch(`${API_BASE}/api/markets/${marketAddress}/user/${account}`),
          fetch(`${API_BASE}/api/markets/${marketAddress}/info`),
        ]);
        
        if (userRes.ok && marketRes.ok) {
          const userData = await userRes.json();
          const marketData = await marketRes.json();
          
          accountInfo = [
            BigInt(userData.aClaims),
            BigInt(userData.bClaims),
            userData.redeemed,
          ];
          pools = {
            A: BigInt(marketData.pools.A),
            B: BigInt(marketData.pools.B),
          };
          winner = marketData.winner || 0;
        } else {
          // Fallback to on-chain if API fails
          const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
          [accountInfo, pools, winner] = await Promise.all([
            market.a(account) as Promise<[bigint, bigint, boolean]>,
            market.pools() as Promise<{ A: bigint; B: bigint } | [bigint, bigint]>,
            market.winner() as Promise<bigint | number>,
          ]);
        }
      } else {
        // Direct on-chain read
        const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
        [accountInfo, pools, winner] = await Promise.all([
          market.a(account) as Promise<[bigint, bigint, boolean]>,
          market.pools() as Promise<{ A: bigint; B: bigint } | [bigint, bigint]>,
          market.winner() as Promise<bigint | number>,
        ]);
      }

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
      if (ENABLE_CACHE) {
        // Fetch from API cache
        const response = await fetch(`${API_BASE}/api/user/${account}/balance`);
        if (response.ok) {
          const data = await response.json();
          setBalance(ethers.formatEther(data.balance));
          return;
        }
      }
      
      // Fallback to on-chain read
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

            let phase: number;
            let pools: { A: bigint; B: bigint };
            let winner: number;
            let lockTime: bigint;
            let resolveTime: bigint;

            if (ENABLE_CACHE) {
              // Fetch from API cache
              const infoRes = await fetch(`${API_BASE}/api/markets/${market.marketAddress}/info`);
              if (infoRes.ok) {
                const info = await infoRes.json();
                phase = info.phase;
                pools = {
                  A: BigInt(info.pools.A),
                  B: BigInt(info.pools.B),
                };
                winner = info.winner || 0;
                lockTime = BigInt(info.lockTime);
                resolveTime = BigInt(info.resolveTime);
              } else {
                // Fallback to on-chain
                const contract = new ethers.Contract(market.marketAddress, MARKET_ABI, signer);
                const [phaseData, poolsData, winnerData, lockTimeData, resolveTimeData] = await Promise.all([
                  contract.phase(),
                  contract.pools(),
                  contract.winner(),
                  contract.lockTime(),
                  contract.resolveTime(),
                ]);
                phase = Number(phaseData);
                pools = { A: poolsData.A, B: poolsData.B };
                winner = Number(winnerData);
                lockTime = lockTimeData;
                resolveTime = resolveTimeData;
              }
            } else {
              // Direct on-chain read
              const contract = new ethers.Contract(market.marketAddress, MARKET_ABI, signer);
              const [phaseData, poolsData, winnerData, lockTimeData, resolveTimeData] = await Promise.all([
                contract.phase(),
                contract.pools(),
                contract.winner(),
                contract.lockTime(),
                contract.resolveTime(),
              ]);
              phase = Number(phaseData);
              pools = { A: poolsData.A, B: poolsData.B };
              winner = Number(winnerData);
              lockTime = lockTimeData;
              resolveTime = resolveTimeData;
            }
            
            infos[market.marketAddress] = {
              phase,
              pools,
              winner,
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

      // Check market phase and lockTime RIGHT BEFORE deposit (after approval)
      // This ensures we have the latest state after any transactions
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

      // Deposit
      console.log(`  Depositing ${amount} tokens on outcome ${outcome}...`);
      const depositTx = await market.deposit(outcome, amountWei);
      await depositTx.wait();
      console.log(`  ✅ Deposit successful!`);

      // Update cache after write
      await updateCache(marketAddress, userAddress);

      showSuccess('Deposit successful!', 'Success');
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
      
      showError(`Deposit failed: ${errorMessage}`, 'Deposit Error');
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
      const isWinner = investedInWinner > 0;
      
      const confirmMsg = `Redeem Details:\n\n` +
        `Total Invested: ${investedStr} tokens\n` +
        `Invested in Winner (Outcome ${winner}): ${investedInWinnerStr} tokens\n` +
        `Expected Payout: ${payoutStr} tokens\n\n` +
        `Proceed with redemption?`;
      
      showConfirm(confirmMsg, async () => {
        await executeRedeem(marketAddress, totalInvested, investedInWinner, isWinner);
      }, 'Confirm Redemption');
    } catch (error: any) {
      console.error('Redeem error:', error);
      showError(`Redeem failed: ${error.message || error.reason || 'Unknown error'}`, 'Redeem Error');
    }
  };

  const executeRedeem = async (marketAddress: string, totalInvested: bigint, investedInWinner: bigint, isWinner: boolean) => {
    if (!signer || !account) return;
    try {
      const market = new ethers.Contract(marketAddress, MARKET_ABI, signer);
      
      // Get balance before redeem
      const stakeToken = new ethers.Contract(contractAddresses.stakeToken, STAKE_TOKEN_ABI, signer);
      const balanceBefore = await stakeToken.balanceOf(account) as bigint;
      
      // Execute redeem
      const tx = await market.redeem();
      await tx.wait();
      
      // Wait a bit for state to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update cache after write
      await updateCache(marketAddress, account);
      
      // Get balance after redeem
      const balanceAfter = await stakeToken.balanceOf(account) as bigint;
      const actualPayout = balanceAfter - balanceBefore;
      
      // Show success with actual payout
      const investedStr = ethers.formatEther(totalInvested);
      const actualPayoutStr = ethers.formatEther(actualPayout >= 0 ? actualPayout : BigInt(0));
      const profitLoss = actualPayout - totalInvested;
      const profitLossStr = ethers.formatEther(profitLoss >= 0 ? profitLoss : -profitLoss);
      
      // Format profit/loss more clearly
      let profitLossDisplay: string;
      if (profitLoss > 0) {
        profitLossDisplay = `Profit: +${profitLossStr} tokens`;
      } else if (profitLoss < 0) {
        profitLossDisplay = `Loss: -${profitLossStr} tokens`;
      } else {
        profitLossDisplay = `Break even: 0 tokens`;
      }
      
      const successMsg = `✅ Redeemed successfully!\n\n` +
        `Total Invested: ${investedStr} tokens\n` +
        `Invested in Winner: ${ethers.formatEther(investedInWinner)} tokens\n` +
        `Payout Received: ${actualPayoutStr} tokens\n` +
        `${profitLossDisplay}\n\n` +
        `${isWinner ? '✅ You won!' : '❌ You lost (bet on losing outcome)'}`;
      
      showSuccess(successMsg, 'Redemption Complete');
      
      loadMarkets();
      loadBalance(); // Refresh balance
      
      // Reload user investment to update redeemed status
      await loadUserInvestment(marketAddress);
    } catch (error: any) {
      console.error('Execute redeem error:', error);
      showError(`Redeem failed: ${error.message || error.reason || 'Unknown error'}`, 'Redeem Error');
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
        showError(`Cannot close yet. LockTime: ${new Date(lockTime * 1000).toLocaleString()}\nWait: ${waitHours}h ${waitMinutes}m`, 'Cannot Close');
        setClosing(null);
        return;
      }
      
      const tx = await market.close();
      await tx.wait();
      console.log(`✅ Market closed: ${tx.hash}`);
      
      // Immediately update the phase in state to 1 (Locked) for instant UI feedback
      setMarketInfos((prev) => {
        const updated = { ...prev };
        if (updated[marketAddress]) {
          updated[marketAddress] = {
            ...updated[marketAddress],
            phase: 1, // Locked phase
          };
        }
        return updated;
      });
      
      // Update cache after write
      await updateCache(marketAddress);
      
      // Force backend to sync phases
      try {
        await fetch(`${API_BASE}/api/admin/sync-phases`, { method: 'POST' });
      } catch (e) {
        console.warn('Failed to sync phases:', e);
      }
      
      showSuccess('Market closed successfully!', 'Success');
      // Reload to sync with backend (this will refresh all data including pools, etc.)
      loadMarkets();
    } catch (error: any) {
      console.error('Close error:', error);
      let errorMsg = error.message || error.reason || 'Unknown error';
      if (errorMsg.includes('time') || errorMsg.includes('locked')) {
        errorMsg = `Close failed: lockTime has not been reached yet. ${errorMsg}`;
      }
      showError(`Close failed: ${errorMsg}`, 'Close Error');
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
      
      // Immediately update the phase in state to 2 (Resolved) for instant UI feedback
      setMarketInfos((prev) => {
        const updated = { ...prev };
        if (updated[marketAddress]) {
          updated[marketAddress] = {
            ...updated[marketAddress],
            phase: 2, // Resolved phase
          };
        }
        return updated;
      });
      
      // Update cache after write
      await updateCache(marketAddress);
      
      showSuccess('Market settled successfully!', 'Success');
      loadMarkets();
    } catch (error: any) {
      console.error('Settle error:', error);
      showError(`Settle failed: ${error.message || error.reason || 'Unknown error'}`, 'Settle Error');
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
      showSuccess('Close all request completed. Check console for details.', 'Close All Complete');
      loadMarkets();
    } catch (error: any) {
      console.error('Close-all error:', error);
      showError(`Close all failed: ${error.message || 'Unknown error'}`, 'Close All Error');
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

  // Show loading modal during transactions
  useEffect(() => {
    if (depositing || closing || settling || closingAll) {
      showLoading(depositing ? 'Processing deposit...' : closing ? 'Closing market...' : settling ? 'Settling market...' : 'Closing all markets...');
    } else {
      if (modal.type === 'loading') {
        hideModal();
      }
    }
  }, [depositing, closing, settling, closingAll]);

  // Animate markets on load
  useEffect(() => {
    if (marketsRef.current && markets.length > 0) {
      import('animejs').then(({ animate, stagger }) => {
        const cards = marketsRef.current?.querySelectorAll('.market-card');
        if (cards && cards.length > 0 && marketsRef.current) {
          animate(cards, {
            opacity: [0, 1],
            translateY: [30, 0],
            delay: stagger(100),
            duration: 600,
            easing: 'easeOutQuad',
          });
        }
      });
    }
  }, [markets]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '50px',
              height: '50px',
              border: '4px solid #1a1a1a',
              borderTop: '4px solid #db0dce',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p>Loading markets...</p>
        </div>
      </div>
    );
  }

  const hasTradingMarkets = markets.some((market) => market.status === 'trading');
  const canInteract = isConnected && signer;

  const marketCards = markets.map((market) => {
    const info = marketInfos[market.marketAddress];
    if (!info) return null;

    const lockTimeNum = Number(info.lockTime);
    const resolveTimeNum = Number(info.resolveTime);
    const investment = userInvestments[market.marketAddress];
    const deposits = marketDeposits[market.marketAddress] || [];

    const timelineBox =
      info.phase === 0 || info.phase === 1 ? (
        <div
          style={{
            padding: '12px',
            backgroundColor: 'rgba(219, 13, 206, 0.1)',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #db0dce',
          }}
        >
          <div style={{ fontSize: '12px', color: '#db0dce', marginBottom: '4px' }}>
            {info.phase === 0 ? '⏰ Time until lock' : '⏳ Time until resolve'}
          </div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>
            {formatTimeRemaining(info.phase === 0 ? lockTimeNum : resolveTimeNum)}
          </div>
        </div>
      ) : null;

    const renderPoolCard = (label: string) => (
      <div
        style={{
          padding: '16px',
          border: '2px solid #db0dce',
          borderRadius: '8px',
          backgroundColor: 'rgba(219, 13, 206, 0.05)',
        }}
      >
        <div style={{ fontSize: '12px', color: '#db0dce', marginBottom: '8px' }}>{label}</div>
        <div style={{ fontSize: '24px', fontWeight: '700', color: '#fff' }}>
          {label === (market.type === 'top10' ? 'Yes (Top 10)' : market.projectA)
            ? ethers.formatEther(info.pools.A)
            : ethers.formatEther(info.pools.B)}
        </div>
        <div style={{ fontSize: '12px', color: '#999' }}>tokens</div>
      </div>
    );

    const userInvestmentSection =
      canInteract && investment ? (
        <div
          style={{
            marginTop: '16px',
            padding: '16px',
            border: '2px solid #db0dce',
            borderRadius: '8px',
            backgroundColor: 'rgba(219, 13, 206, 0.1)',
          }}
        >
          <div style={{ fontSize: '14px', color: '#db0dce', fontWeight: '600', marginBottom: '12px' }}>
            Your Investment
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Outcome 1</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>{ethers.formatEther(investment.aClaims)} tokens</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Outcome 2</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>{ethers.formatEther(investment.bClaims)} tokens</div>
            </div>
          </div>
          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid rgba(219, 13, 206, 0.3)',
              fontSize: '14px',
              fontWeight: '600',
              color: '#fff',
            }}
          >
            Total: {ethers.formatEther(investment.totalInvested)} tokens
          </div>
          {info.phase === 2 && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(219, 13, 206, 0.3)' }}>
              {investment.totalInvested === BigInt(0) ? (
                <div style={{ color: '#999', fontSize: '14px' }}>No investment</div>
              ) : investment.redeemed ? (
                <div style={{ color: '#10b981', fontSize: '14px', fontWeight: '600' }}>✅ Winner - Already Redeemed</div>
              ) : investment.isWinner ? (
                <div>
                  <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '4px' }}>Potential Payout</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
                    {ethers.formatEther(investment.potentialPayout)} tokens
                  </div>
                  <div style={{ color: '#10b981', fontSize: '14px', marginTop: '4px' }}>✅ Winner!</div>
                </div>
              ) : (
                <div style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600' }}>
                  ❌ Loser
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', fontWeight: '400' }}>
                    (No payout - you bet on the losing outcome)
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null;

    const depositsSection = (
      <div style={{ marginTop: '16px' }}>
        <button
          onClick={async () => {
            const isExpanded = expandedDeposits[market.marketAddress];
            if (!isExpanded && marketDeposits[market.marketAddress] === undefined) {
              // Load deposits if not already loaded
              await loadDeposits(market.marketAddress);
            }
            setExpandedDeposits(prev => ({
              ...prev,
              [market.marketAddress]: !isExpanded,
            }));
          }}
          disabled={loadingDeposits[market.marketAddress]}
          style={{
            padding: '10px 20px',
            backgroundColor: expandedDeposits[market.marketAddress] ? '#db0dce' : 'transparent',
            color: expandedDeposits[market.marketAddress] ? '#fff' : '#db0dce',
            border: '2px solid #db0dce',
            borderRadius: '8px',
            cursor: loadingDeposits[market.marketAddress] ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s',
            opacity: loadingDeposits[market.marketAddress] ? 0.5 : 1,
            width: '100%',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {loadingDeposits[market.marketAddress] ? (
            'Loading...'
          ) : expandedDeposits[market.marketAddress] ? (
            <>
              <span>▼</span> Hide Bets
            </>
          ) : (
            <>
              <span>▶</span> Show Top 10 Bets
            </>
          )}
        </button>
        {expandedDeposits[market.marketAddress] && marketDeposits[market.marketAddress] !== undefined &&
          (deposits.length > 0 ? (
            <div
              style={{
                marginTop: '12px',
                border: '2px solid #db0dce',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(219, 13, 206, 0.05)',
              }}
            >
              <h4 style={{ margin: '0 0 16px 0', color: '#db0dce', fontSize: '16px', fontWeight: '600' }}>
                Top 10 Latest Bets
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[1, 2].map((outcome) => {
                  const outcomeDeposits = deposits
                    .filter((d) => d.outcome === outcome)
                    .slice(0, 10); // Top 10 latest
                  
                  return (
                    <div key={outcome}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#db0dce', marginBottom: '8px' }}>
                        {outcome === 1
                          ? market.type === 'top10'
                            ? 'Yes (Top 10)'
                            : market.projectA
                          : market.type === 'top10'
                          ? 'No (Not Top 10)'
                          : market.projectB}
                        {outcomeDeposits.length > 0 && (
                          <span style={{ color: '#999', fontSize: '12px', marginLeft: '8px', fontWeight: '400' }}>
                            ({outcomeDeposits.length})
                          </span>
                        )}
                      </div>
                      {outcomeDeposits.length > 0 ? (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {outcomeDeposits.map((d, i) => (
                            <li
                              key={`${d.user}-${i}`}
                              style={{
                                fontSize: '12px',
                                padding: '6px 8px',
                                marginBottom: '4px',
                                backgroundColor: 'rgba(219, 13, 206, 0.1)',
                                borderRadius: '4px',
                                color: '#fff',
                              }}
                            >
                              {d.user.slice(0, 6)}...{d.user.slice(-4)}: {ethers.formatEther(d.amount)} tokens
                              {info.phase === 2 && info.winner === outcome && (
                                <span style={{ color: '#10b981', marginLeft: '8px', fontWeight: '600' }}>✅ Winner</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ color: '#999', fontSize: '12px', fontStyle: 'italic' }}>No bets yet</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: '12px',
                padding: '16px',
                color: '#999',
                fontStyle: 'italic',
                textAlign: 'center',
                border: '1px dashed #db0dce',
                borderRadius: '8px',
              }}
            >
              No bets found for this market yet.
            </div>
          ))}
      </div>
    );

    const depositActionsSection =
      info.phase === 0 && canInteract ? (
        <div
          style={{
            marginTop: '20px',
            padding: '20px',
            border: '2px solid #db0dce',
            borderRadius: '8px',
            backgroundColor: 'rgba(219, 13, 206, 0.05)',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#db0dce', marginBottom: '12px' }}>Place Bet</div>
          <input
            type="number"
            id={`amount-${market.marketAddress}`}
            placeholder="Amount"
            defaultValue="100"
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '12px',
              backgroundColor: '#000',
              border: '2px solid #db0dce',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '16px',
              boxSizing: 'border-box',
              outline: 'none',
              textAlign: 'left',
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[1, 2].map((outcome) => (
              <button
                key={outcome}
                onClick={() => {
                  const amount = (document.getElementById(`amount-${market.marketAddress}`) as HTMLInputElement)?.value;
                  if (amount) deposit(market.marketAddress, outcome as 1 | 2, amount);
                }}
                disabled={depositing === market.marketAddress}
                style={{
                  padding: '12px 20px',
                  backgroundColor: depositing === market.marketAddress ? '#1a1a1a' : '#db0dce',
                  color: '#fff',
                  border: '2px solid #db0dce',
                  borderRadius: '8px',
                  cursor: depositing === market.marketAddress ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  opacity: depositing === market.marketAddress ? 0.5 : 1,
                }}
              >
                {depositing === market.marketAddress
                  ? 'Processing...'
                  : outcome === 1
                  ? market.type === 'top10'
                    ? 'Yes (Top 10)'
                    : market.projectA
                  : market.type === 'top10'
                  ? 'No (Not Top 10)'
                  : market.projectB}
              </button>
            ))}
          </div>
        </div>
      ) : null;

    const redeemButton =
      info.phase === 2 && canInteract && investment && investment.totalInvested > BigInt(0) ? (
        <button
          onClick={() => redeem(market.marketAddress)}
          disabled={investment?.redeemed === true}
          style={{
            width: '100%',
            padding: '14px 20px',
            marginTop: '16px',
            backgroundColor: investment?.redeemed ? '#1a1a1a' : '#10b981',
            color: '#fff',
            border: `2px solid ${investment?.redeemed ? '#666' : '#10b981'}`,
            borderRadius: '8px',
            cursor: investment?.redeemed ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '16px',
            transition: 'all 0.2s',
            opacity: investment?.redeemed ? 0.5 : 1,
          }}
        >
          {investment?.redeemed ? 'Already Redeemed' : 'Redeem'}
        </button>
      ) : null;

    const adminActions =
      isAdmin && canInteract ? (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            border: '2px solid #fbbf24',
            borderRadius: '8px',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fbbf24', marginBottom: '12px' }}>Admin Actions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {info.phase === 0 && (
              <button
                onClick={() => closeMarket(market.marketAddress)}
                disabled={closing === market.marketAddress}
                style={{
                  padding: '10px 20px',
                  backgroundColor: closing === market.marketAddress ? '#1a1a1a' : 'transparent',
                  color: closing === market.marketAddress ? '#666' : '#fbbf24',
                  border: '2px solid #fbbf24',
                  borderRadius: '6px',
                  cursor: closing === market.marketAddress ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  opacity: closing === market.marketAddress ? 0.5 : 1,
                }}
              >
                {closing === market.marketAddress ? 'Closing...' : 'Close Market'}
              </button>
            )}
            {info.phase === 1 && (
              <button
                onClick={() => settleMarket(market.marketAddress)}
                disabled={settling === market.marketAddress}
                style={{
                  padding: '10px 20px',
                  backgroundColor: settling === market.marketAddress ? '#1a1a1a' : 'transparent',
                  color: settling === market.marketAddress ? '#666' : '#10b981',
                  border: '2px solid #10b981',
                  borderRadius: '6px',
                  cursor: settling === market.marketAddress ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                  opacity: settling === market.marketAddress ? 0.5 : 1,
                }}
              >
                {settling === market.marketAddress ? 'Settling...' : 'Settle Market'}
              </button>
            )}
          </div>
        </div>
      ) : null;


    return (
      <div
        key={market.marketAddress}
        className="market-card"
        style={{
          border: '2px solid #db0dce',
          borderRadius: '12px',
          padding: '24px',
          backgroundColor: '#0a0a0a',
          transition: 'all 0.3s',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <h3
          style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 16px 0',
            color: '#fff',
            lineHeight: '1.4',
          }}
        >
          {market.type === 'top10'
            ? `Top-10: Will ${market.projectName} be in Top 10?`
            : `H2H: Who will rank higher - ${market.projectA} or ${market.projectB}?`}
        </h3>

        <div
          style={{
            display: 'inline-block',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '16px',
            backgroundColor:
              info.phase === 0
                ? 'rgba(219, 13, 206, 0.2)'
                : info.phase === 1
                ? 'rgba(251, 191, 36, 0.2)'
                : info.phase === 2
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(107, 114, 128, 0.2)',
            color: info.phase === 0 ? '#db0dce' : info.phase === 1 ? '#fbbf24' : info.phase === 2 ? '#10b981' : '#6b7280',
            border: `1px solid ${info.phase === 0 ? '#db0dce' : info.phase === 1 ? '#fbbf24' : info.phase === 2 ? '#10b981' : '#6b7280'}`,
          }}
        >
          {getPhaseName(info.phase)}
        </div>
        {timelineBox}
        
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          {renderPoolCard(market.type === 'top10' ? 'Yes (Top 10)' : market.projectA!)}
          {renderPoolCard(market.type === 'top10' ? 'No (Not Top 10)' : market.projectB!)}
        </div>
        
        {info.phase === 2 && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              border: '2px solid #10b981',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '4px' }}>🏆 Winner</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#10b981' }}>
              {info.winner === 1 ? (market.type === 'top10' ? 'Yes (Top 10)' : market.projectA) : (market.type === 'top10' ? 'No (Not Top 10)' : market.projectB)}
            </div>
          </div>
        )}

        {userInvestmentSection}
        {depositsSection}
        {depositActionsSection}
        {redeemButton}
        {adminActions}
      </div>
    );
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', color: '#fff' }}>
      <ModalManager modal={modal} onClose={hideModal} />
      
      {/* Header Section */}
      <div style={{ marginBottom: '40px' }}>
        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: '700',
            margin: '0 0 16px 0',
            background: 'linear-gradient(135deg, #db0dce 0%, #fff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Prediction Markets
        </h1>
        {!canInteract && (
          <div
            style={{
              padding: '16px',
              border: '2px solid #db0dce',
              borderRadius: '8px',
              backgroundColor: 'rgba(219, 13, 206, 0.1)',
              color: '#db0dce',
              marginBottom: '24px',
            }}
          >
            Please connect your wallet to interact with markets.
          </div>
        )}
        {isAdmin && (
          <div
            style={{
              padding: '12px 16px',
              border: '2px solid #10b981',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              fontWeight: '600',
              marginBottom: '24px',
              display: 'inline-block',
            }}
          >
            ⚡ Admin Mode: You can close and settle markets
          </div>
        )}
        
        {/* Balance and Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
          {isConnected && balance !== null && (
            <div
              style={{
                padding: '12px 20px',
                border: '2px solid #db0dce',
                borderRadius: '8px',
                backgroundColor: 'rgba(219, 13, 206, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <strong style={{ color: '#db0dce' }}>Your Balance:</strong>
              <span style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>{balance} tokens</span>
              <button
                onClick={loadBalance}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: '#db0dce',
                  border: '1px solid #db0dce',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#db0dce';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#db0dce';
                }}
              >
                Refresh
              </button>
            </div>
          )}
          <button
            onClick={loadMarkets}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: '#db0dce',
              border: '2px solid #db0dce',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#db0dce';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#db0dce';
            }}
          >
            Refresh Markets
          </button>
          {isAdmin && (
            <button
              onClick={async () => {
                try {
                  await fetch(`${API_BASE}/api/admin/sync-phases`, { method: 'POST' });
                  loadMarkets();
                  showSuccess('Phases synced!', 'Success');
                } catch (e) {
                  showError('Failed to sync phases', 'Sync Error');
                }
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: '#10b981',
                border: '2px solid #10b981',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#10b981';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#10b981';
              }}
            >
              Sync Phases
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() =>
                showConfirm(
                  'Regenerate leaderboard? This will randomize today\'s leaderboard and create a new snapshot.',
                  async () => {
                    try {
                      const response = await fetch(`${API_BASE}/api/admin/regenerate-leaderboard`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                      });
                      const data = await response.json();
                      if (response.ok) {
                        showSuccess(
                          `✅ Leaderboard regenerated!\n\nNew snapshot index: ${data.index}\nTop 10: ${data.top10.join(', ')}`,
                          'Success'
                        );
                      } else {
                        showError(`Error: ${data.error || 'Failed to regenerate leaderboard'}`, 'Error');
                      }
                    } catch (error: any) {
                      showError(`Error: ${error.message || 'Failed to regenerate leaderboard'}`, 'Error');
                    }
                  },
                  'Confirm Regeneration'
                )
              }
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: '#3b82f6',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#3b82f6';
              }}
            >
              Regenerate Leaderboard
            </button>
          )}
          {isAdmin && hasTradingMarkets && (
            <button
              onClick={closeAllMarkets}
              disabled={closingAll || !canInteract}
              style={{
                padding: '12px 24px',
                backgroundColor: closingAll ? '#1a1a1a' : 'transparent',
                color: closingAll ? '#666' : '#ef4444',
                border: '2px solid #ef4444',
                borderRadius: '8px',
                cursor: closingAll ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s',
                opacity: closingAll ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!closingAll) {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (!closingAll) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#ef4444';
                }
              }}
            >
              {closingAll ? 'Closing all...' : 'Close All Markets'}
            </button>
          )}
        </div>
      </div>

      {/* Markets Grid */}
      <div ref={marketsRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
        {marketCards}
      </div>
      {markets.length === 0 && !loading && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#999',
            border: '2px dashed #db0dce',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: '#fff' }}>
            No markets available
          </div>
          <div style={{ fontSize: '14px' }}>Markets will appear here once they are created.</div>
        </div>
      )}
    </div>
  );
}

