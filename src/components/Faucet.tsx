import { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { STAKE_TOKEN_ABI } from '../config';
import { useContracts } from '../hooks/useContracts';

export default function Faucet() {
  const { account, signer, isConnected } = useWallet();
  const { contracts, loading: contractsLoading } = useContracts();
  const [requesting, setRequesting] = useState(false);
  const [amount, setAmount] = useState('1000');

  const requestTokens = async () => {
    if (!signer || !account) {
      alert('Please connect your wallet first');
      return;
    }

    // Validate amount (max 1000 tokens)
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (amountNum > 1000) {
      alert('Maximum 1000 tokens per request');
      return;
    }

    setRequesting(true);
    try {
      // In a real implementation, you'd call a faucet contract
      // For now, we'll use the deployer account to send tokens
      // This requires the deployer's private key in the backend
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: account, amount }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Success! ${amount} tokens sent to ${account}. Transaction: ${data.txHash}`);
        // Wait a moment for the transaction to be mined, then refresh balance
        setTimeout(() => {
          window.location.reload(); // Simple refresh to update balance
        }, 2000);
      } else {
        alert(`Error: ${data.error || 'Failed to request tokens'}`);
      }
    } catch (error: any) {
      console.error('Faucet error:', error);
      alert(`Error: ${error.message || 'Failed to request tokens'}`);
    } finally {
      setRequesting(false);
    }
  };

  const checkBalance = async () => {
    if (!signer || !account) {
      alert('Please connect your wallet first');
      return;
    }
    if (!contracts.stakeToken || contracts.stakeToken === '') {
      alert('Stake token address not loaded. Please wait a moment and try again.');
      return;
    }
    try {
      const stakeToken = new ethers.Contract(contracts.stakeToken, STAKE_TOKEN_ABI, signer);
      if (!stakeToken || typeof stakeToken.balanceOf !== 'function') {
        throw new Error('Invalid contract instance - balanceOf is not a function');
      }
      const balance = await stakeToken.balanceOf(account);
      alert(`Your balance: ${ethers.formatEther(balance)} tokens`);
    } catch (error: any) {
      console.error('Error checking balance:', error);
      alert(`Error: ${error.message || 'Failed to check balance'}`);
    }
  };

  if (!isConnected) {
    return <div>Please connect your wallet to use the faucet</div>;
  }

  if (contractsLoading) {
    return <div>Loading contract addresses...</div>;
  }

  return (
    <div>
      <h2>Token Faucet</h2>
      <div>
        <label>
          Amount (max 1000): 
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || (parseFloat(val) >= 0 && parseFloat(val) <= 1000)) {
                setAmount(val);
              }
            }}
            placeholder="1000"
            max={1000}
            min={0}
          />
        </label>
      </div>
      <button onClick={requestTokens} disabled={requesting}>
        {requesting ? 'Requesting...' : 'Request Tokens'}
      </button>
      <button onClick={checkBalance}>Check Balance</button>
    </div>
  );
}

