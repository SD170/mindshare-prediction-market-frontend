import { useState, useEffect } from 'react';
import { getTodayLeaderboard, getYesterdayLeaderboard, Project } from '../api/leaderboard';

export default function Leaderboard() {
  const [today, setToday] = useState<Project[]>([]);
  const [yesterday, setYesterday] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboards();
  }, []);

  const loadLeaderboards = async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayData, yesterdayData] = await Promise.all([
        getTodayLeaderboard(),
        getYesterdayLeaderboard(),
      ]);
      setToday(todayData);
      setYesterday(yesterdayData);
    } catch (err) {
      setError('Failed to load leaderboards');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading leaderboards...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Leaderboards</h2>
      
      <div>
        <h3>Today's Leaderboard</h3>
        <table border={1}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {today.map((project) => (
              <tr key={project.name}>
                <td>{project.rank}</td>
                <td>{project.name}</td>
                <td>{project.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3>Yesterday's Leaderboard</h3>
        <table border={1}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {yesterday.map((project) => (
              <tr key={project.name}>
                <td>{project.rank}</td>
                <td>{project.name}</td>
                <td>{project.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={loadLeaderboards}>Refresh</button>
    </div>
  );
}

