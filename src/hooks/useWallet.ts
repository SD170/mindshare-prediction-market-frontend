import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONFIG } from '../config';

export function useWallet() {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [ignoreAccountChanges, setIgnoreAccountChanges] = useState(false);

  useEffect(() => {
    // Only auto-connect if user hasn't explicitly disconnected
    const wasDisconnected = localStorage.getItem('wallet_disconnected') === 'true';
    if (!wasDisconnected) {
      checkConnection();
    }
    
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
          setProvider(provider);
          setSigner(await provider.getSigner());
          // Clear disconnected flag if we successfully connected
          localStorage.removeItem('wallet_disconnected');
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (ignoreAccountChanges && accounts.length > 0) {
      return;
    }

    if (accounts.length === 0) {
      // User disconnected from MetaMask
      setAccount(null);
      setProvider(null);
      setSigner(null);
      setIgnoreAccountChanges(false);
      localStorage.setItem('wallet_disconnected', 'true');
    } else {
      // User switched accounts
      setAccount(accounts[0]);
      localStorage.removeItem('wallet_disconnected');
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const connect = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    setIsConnecting(true);
    try {
      setIgnoreAccountChanges(false);
      
      // Clear disconnected flag before connecting
      localStorage.removeItem('wallet_disconnected');
      
      // Request accounts - this should show account picker in MetaMask
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      
      // If MetaMask has multiple accounts, try to trigger account selection
      // by requesting permissions (this might show account picker)
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch (error) {
        // Ignore errors - some wallets don't support this or user cancelled
        // The eth_requestAccounts above should have worked
      }
      
      const network = await provider.getNetwork();
      
      if (Number(network.chainId) !== CONFIG.CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CONFIG.CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${CONFIG.CHAIN_ID.toString(16)}`,
                chainName: 'Base Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: [CONFIG.RPC_URL],
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              }],
            });
          }
        }
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      setProvider(provider);
      setSigner(signer);
      // Clear disconnected flag on successful connection
      localStorage.removeItem('wallet_disconnected');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setIgnoreAccountChanges(true);
    setAccount(null);
    setProvider(null);
    setSigner(null);
    // Store disconnected state so it persists after refresh
    localStorage.setItem('wallet_disconnected', 'true');
  };

  return {
    account,
    provider,
    signer,
    isConnecting,
    connect,
    disconnect,
    isConnected: !!account,
  };
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

