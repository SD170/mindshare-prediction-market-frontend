import { useEffect, useState } from 'react';
import { CONFIG, ContractAddresses } from '../config';

interface ApiContract {
  type: string;
  address: string;
}

export function useContracts() {
  const [contracts, setContracts] = useState<ContractAddresses>(CONFIG.CONTRACTS);
  const [loading, setLoading] = useState(true);
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    async function fetchContracts() {
      try {
        const response = await fetch(`${apiBase}/api/contracts`);
        if (!response.ok) throw new Error('Failed to load contracts');
        const data: ApiContract[] = await response.json();
        const map: ContractAddresses = { ...CONFIG.CONTRACTS };
        data.forEach((entry) => {
          if (entry.type === 'settlementOracle') map.settlementOracle = entry.address;
          if (entry.type === 'marketFactory') map.marketFactory = entry.address;
          if (entry.type === 'stakeToken') map.stakeToken = entry.address;
        });
        setContracts(map);
      } catch (error) {
        console.error('Failed to fetch contracts, using fallback config', error);
      } finally {
        setLoading(false);
      }
    }
    fetchContracts();
  }, [apiBase]);

  return { contracts, loading };
}

