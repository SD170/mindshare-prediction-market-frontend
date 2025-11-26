import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { STAKE_TOKEN_ABI } from '../config';
import { useContracts } from '../hooks/useContracts';
import { useModal } from '../hooks/useModal';
import { ModalManager } from './ModalManager';
// animejs v4 uses dynamic import

export default function Faucet() {
  const { account, signer, isConnected } = useWallet();
  const { contracts, loading: contractsLoading } = useContracts();
  const { modal, showSuccess, showError, showLoading, hideModal } = useModal();
  const [requesting, setRequesting] = useState(false);
  const [amount, setAmount] = useState('1000');
  const [balance, setBalance] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      import('animejs').then(({ animate }) => {
        const container = containerRef.current;
        if (container) {
          animate(container, {
          opacity: [0, 1],
          translateY: [30, 0],
          duration: 600,
          easing: 'easeOutQuad',
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (requesting) {
      showLoading('Requesting tokens...');
    } else {
      if (modal.type === 'loading') {
        hideModal();
      }
    }
  }, [requesting]);

  useEffect(() => {
    if (isConnected && account && signer && contracts.stakeToken) {
      loadBalance();
    }
  }, [isConnected, account, signer, contracts.stakeToken]);

  const loadBalance = async () => {
    if (!signer || !account || !contracts.stakeToken) return;
    try {
      const stakeToken = new ethers.Contract(contracts.stakeToken, STAKE_TOKEN_ABI, signer);
      const bal = await stakeToken.balanceOf(account);
      setBalance(ethers.formatEther(bal));
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const requestTokens = async () => {
    if (!signer || !account) {
      showError('Please connect your wallet first', 'Wallet Not Connected');
      return;
    }

    // Validate amount (max 1000 tokens)
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showError('Please enter a valid amount', 'Invalid Amount');
      return;
    }
    if (amountNum > 1000) {
      showError('Maximum 1000 tokens per request', 'Amount Too Large');
      return;
    }

    setRequesting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: account, amount }),
      });

      const data = await response.json();
      if (response.ok) {
        showSuccess(
          `Success! ${amount} tokens sent to ${account.slice(0, 6)}...${account.slice(-4)}.\n\nTransaction: ${data.txHash}`,
          'Tokens Delivered'
        );
        setTimeout(() => {
          loadBalance();
        }, 2000);
      } else {
        showError(`Error: ${data.error || 'Failed to request tokens'}`, 'Request Failed');
      }
    } catch (error: any) {
      console.error('Faucet error:', error);
      showError(`Error: ${error.message || 'Failed to request tokens'}`, 'Request Failed');
    } finally {
      setRequesting(false);
    }
  };

  const checkBalance = async () => {
    if (!signer || !account) {
      showError('Please connect your wallet first', 'Wallet Not Connected');
      return;
    }
    if (!contracts.stakeToken || contracts.stakeToken === '') {
      showError('Stake token address not loaded. Please wait a moment and try again.', 'Contract Not Loaded');
      return;
    }
    try {
      const stakeToken = new ethers.Contract(contracts.stakeToken, STAKE_TOKEN_ABI, signer);
      if (!stakeToken || typeof stakeToken.balanceOf !== 'function') {
        throw new Error('Invalid contract instance - balanceOf is not a function');
      }
      const bal = await stakeToken.balanceOf(account);
      const balanceStr = ethers.formatEther(bal);
      setBalance(balanceStr);
      showSuccess(`Your balance: ${balanceStr} tokens`, 'Balance');
    } catch (error: any) {
      console.error('Error checking balance:', error);
      showError(`Error: ${error.message || 'Failed to check balance'}`, 'Balance Check Failed');
    }
  };

  if (!isConnected) {
    return (
      <div
        ref={containerRef}
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '40px',
          border: '2px solid #db0dce',
          borderRadius: '12px',
          backgroundColor: '#0a0a0a',
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '12px', color: '#db0dce' }}>
          Wallet Not Connected
        </h2>
        <p style={{ color: '#999' }}>Please connect your wallet to use the faucet.</p>
      </div>
    );
  }

  if (contractsLoading) {
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
          <p>Loading contract addresses...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ maxWidth: '600px', margin: '0 auto', color: '#fff' }}>
      <ModalManager modal={modal} onClose={hideModal} />
      
      <div
        style={{
          border: '2px solid #db0dce',
          borderRadius: '12px',
          padding: '40px',
          backgroundColor: '#0a0a0a',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 40px)',
            fontWeight: '700',
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #db0dce 0%, #fff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Token Faucet
        </h1>
        <p style={{ color: '#999', marginBottom: '32px', fontSize: '16px' }}>
          Request test tokens to participate in prediction markets
        </p>

        {balance !== null && (
          <div
            style={{
              padding: '16px 20px',
              border: '2px solid #db0dce',
              borderRadius: '8px',
              backgroundColor: 'rgba(219, 13, 206, 0.1)',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#db0dce', fontWeight: '600' }}>Your Balance:</span>
            <span style={{ color: '#fff', fontSize: '20px', fontWeight: '700' }}>{balance} tokens</span>
          </div>
        )}

        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              color: '#db0dce',
              fontWeight: '600',
              marginBottom: '8px',
            }}
          >
            Amount (max 1000 tokens)
          </label>
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
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#000',
              border: '2px solid #db0dce',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '18px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={requestTokens}
            disabled={requesting}
            style={{
              flex: 1,
              padding: '16px 24px',
              backgroundColor: requesting ? '#1a1a1a' : '#db0dce',
              color: '#fff',
              border: '2px solid #db0dce',
              borderRadius: '8px',
              cursor: requesting ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '16px',
              transition: 'all 0.2s',
              opacity: requesting ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!requesting) {
                e.currentTarget.style.backgroundColor = '#b80bb8';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(219, 13, 206, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!requesting) {
                e.currentTarget.style.backgroundColor = '#db0dce';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {requesting ? 'Requesting...' : 'Request Tokens'}
          </button>
          <button
            onClick={checkBalance}
            style={{
              padding: '16px 24px',
              backgroundColor: 'transparent',
              color: '#db0dce',
              border: '2px solid #db0dce',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '16px',
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
            Check Balance
          </button>
        </div>
      </div>
    </div>
  );
}

