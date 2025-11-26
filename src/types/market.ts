export interface Market {
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

export interface MarketInfo {
  phase: number;
  pools: { A: bigint; B: bigint };
  winner: number;
  lockTime: bigint;
  resolveTime: bigint;
}

export interface DepositInfo {
  user: string;
  outcome: number;
  amount: bigint;
  blockNumber: number;
}

export interface UserInvestment {
  aClaims: bigint;
  bClaims: bigint;
  totalInvested: bigint;
  potentialPayout: bigint;
  isWinner: boolean;
  redeemed: boolean;
}

