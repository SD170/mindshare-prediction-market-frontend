import { useState } from 'react';
import { useWallet } from './hooks/useWallet';
import Leaderboard from './components/Leaderboard';
import Markets from './components/Markets';
import Faucet from './components/Faucet';

function App() {
  const { account, connect, disconnect, isConnected } = useWallet();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'markets' | 'faucet'>('leaderboard');

  return (
    <div>
      <header>
        <h1>Mindshare Prediction Markets</h1>
        <div>
          {!isConnected ? (
            <button onClick={connect}>Connect Wallet</button>
          ) : (
            <div>
              <span>Connected: {account}</span>
              <button onClick={disconnect}>Disconnect</button>
            </div>
          )}
        </div>
      </header>

      <nav>
        <button onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
        <button onClick={() => setActiveTab('markets')}>Markets</button>
        <button onClick={() => setActiveTab('faucet')}>Faucet</button>
      </nav>

      <main>
        {activeTab === 'leaderboard' && <Leaderboard />}
        {activeTab === 'markets' && <Markets />}
        {activeTab === 'faucet' && <Faucet />}
      </main>
    </div>
  );
}

export default App;

