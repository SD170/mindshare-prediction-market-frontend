export interface ContractAddresses {
  settlementOracle: string;
  marketFactory: string;
  stakeToken: string;
}

const defaultContracts: ContractAddresses = {
  settlementOracle: import.meta.env.VITE_SETTLEMENT_ORACLE || "",
  marketFactory: import.meta.env.VITE_MARKET_FACTORY || "",
  stakeToken: import.meta.env.VITE_STAKE_TOKEN || "",
};

export const CONFIG = {
  RPC_URL: import.meta.env.VITE_RPC_URL || "https://sepolia.base.org",
  CHAIN_ID: 84532, // Base Sepolia
  CONTRACTS: defaultContracts,
  ADMIN_WALLET: "0xc5b2130f38eac51a1b93723509237572963322e9",
};

export const STAKE_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
] as const;

export const MARKET_ABI = [
  "function deposit(uint8 outcome, uint256 amount) external",
  "function close() external",
  "function settle() external",
  "function redeem() external",
  "function phase() external view returns (uint8)",
  "function pools() external view returns (uint128 A, uint128 B)",
  "function winner() external view returns (uint8)",
  "function marketId() external view returns (bytes32)",
  "function questionHash() external view returns (bytes32)",
  "function lockTime() external view returns (uint64)",
  "function resolveTime() external view returns (uint64)",
  "function stakeToken() external view returns (address)",
  "function a(address) external view returns (uint128 aClaims, uint128 bClaims, bool redeemed)",
  "event Deposit(address indexed user, uint8 indexed outcome, uint256 amount)",
] as const;

export const MARKET_FACTORY_ABI = [
  "function computeMarketId(bytes32 questionHash, uint64 lockTime) public view returns (bytes32)",
] as const;

