import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { MarketsPage } from './pages/MarketsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { FaucetPage } from './pages/FaucetPage';

function App() {
  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }
        #root {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100vh;
        }
      `}</style>
      <Router>
        <div style={{ minHeight: '100vh', backgroundColor: '#000', margin: 0, padding: 0 }}>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/faucet" element={<FaucetPage />} />
          </Routes>
        </div>
      </Router>
    </>
  );
}

export default App;

