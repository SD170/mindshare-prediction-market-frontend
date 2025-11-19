import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Project {
  name: string;
  rank: number;
  score: number;
  logo: string;
}

export async function getTodayLeaderboard(): Promise<Project[]> {
  try {
    const response = await axios.get(`${API_BASE}/api/leaderboard/today`);
    return response.data;
  } catch (error) {
    console.error('Error fetching today leaderboard:', error);
    throw error;
  }
}

export async function getYesterdayLeaderboard(): Promise<Project[]> {
  try {
    const response = await axios.get(`${API_BASE}/api/leaderboard/yesterday`);
    return response.data;
  } catch (error) {
    console.error('Error fetching yesterday leaderboard:', error);
    throw error;
  }
}

