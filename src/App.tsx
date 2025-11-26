import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { MarketsPage } from './pages/MarketsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { FaucetPage } from './pages/FaucetPage';

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', backgroundColor: '#000' }}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/faucet" element={<FaucetPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

