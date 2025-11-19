import { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { CONFIG, STAKE_TOKEN_ABI } from '../config';
import { useContracts } from '../hooks/useContracts';

export default function Faucet() {
  const { account, signer, isConnected } = useWallet();
  const { contracts } = useContracts();
  const [requesting, setRequesting] = useState(false);
  const [amount, setAmount] = useState('1000');

  const requestTokens = async () => {
    if (!signer || !account) {
      alert('Please connect your wallet first');
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
        alert(`Success! ${amount} tokens sent to ${account}`);
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
    if (!signer || !account) return;
    try {
      const stakeToken = new ethers.Contract(contracts.stakeToken, STAKE_TOKEN_ABI, signer);
      const balance = await stakeToken.balanceOf(account);
      alert(`Your balance: ${ethers.formatEther(balance)} tokens`);
    } catch (error) {
      console.error('Error checking balance:', error);
    }
  };

  if (!isConnected) {
    return <div>Please connect your wallet to use the faucet</div>;
  }

  return (
    <div>
      <h2>Token Faucet</h2>
      <div>
        <label>
          Amount: 
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000"
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

