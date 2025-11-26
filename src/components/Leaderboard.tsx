import { useState, useEffect, useRef } from 'react';
import { getTodayLeaderboard, getYesterdayLeaderboard, Project } from '../api/leaderboard';
// animejs v4 uses dynamic import

export default function Leaderboard() {
  const [today, setToday] = useState<Project[]>([]);
  const [yesterday, setYesterday] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const yesterdayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLeaderboards();
  }, []);

  useEffect(() => {
    if (!loading && today.length > 0 && todayRef.current) {
      import('animejs').then(({ animate, stagger }) => {
        const rows = todayRef.current?.querySelectorAll('.leaderboard-row');
        if (rows && rows.length > 0) {
          animate(rows, {
            opacity: [0, 1],
            translateX: [-20, 0],
            delay: stagger(30),
            duration: 400,
            easing: 'easeOutQuad',
          });
        }
      });
    }
  }, [loading, today]);

  useEffect(() => {
    if (!loading && yesterday.length > 0 && yesterdayRef.current) {
      import('animejs').then(({ animate, stagger }) => {
        const rows = yesterdayRef.current?.querySelectorAll('.leaderboard-row');
        if (rows && rows.length > 0) {
          animate(rows, {
            opacity: [0, 1],
            translateX: [-20, 0],
            delay: stagger(30),
            duration: 400,
            easing: 'easeOutQuad',
          });
        }
      });
    }
  }, [loading, yesterday]);

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

  if (loading) {
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
          <p>Loading leaderboards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '40px',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          backgroundColor: '#0a0a0a',
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '12px', color: '#ef4444' }}>
          Error Loading Leaderboards
        </h2>
        <p style={{ color: '#999', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={loadLeaderboards}
          style={{
            padding: '12px 24px',
            backgroundColor: '#db0dce',
            color: '#fff',
            border: '2px solid #db0dce',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const LeaderboardTable = ({ projects, title, ref }: { projects: Project[]; title: string; ref: React.RefObject<HTMLDivElement> }) => (
    <div style={{ marginBottom: '40px' }}>
      <h2
        style={{
          fontSize: 'clamp(28px, 4vw, 36px)',
          fontWeight: '700',
          margin: '0 0 24px 0',
          color: '#db0dce',
          borderBottom: '2px solid #db0dce',
          paddingBottom: '12px',
        }}
      >
        {title}
      </h2>
      <div
        ref={ref}
        style={{
          border: '2px solid #db0dce',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#0a0a0a',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr 150px',
            padding: '16px 20px',
            backgroundColor: 'rgba(219, 13, 206, 0.2)',
            borderBottom: '2px solid #db0dce',
            fontWeight: '600',
            color: '#db0dce',
            fontSize: '14px',
          }}
        >
          <div>Rank</div>
          <div>Project</div>
          <div style={{ textAlign: 'right' }}>Score</div>
        </div>
        {projects.map((project, index) => {
          const rank = index + 1;
          const isTop3 = rank <= 3;
          const isTop10 = rank <= 10;
          
          return (
          <div
            key={project.name}
            className="leaderboard-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 150px',
              padding: '16px 20px',
              borderBottom: index < projects.length - 1 ? '1px solid rgba(219, 13, 206, 0.2)' : 'none',
              backgroundColor: isTop3 ? 'rgba(219, 13, 206, 0.05)' : isTop10 ? 'rgba(244, 114, 182, 0.03)' : 'transparent',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isTop3 
                ? 'rgba(219, 13, 206, 0.15)' 
                : isTop10 
                ? 'rgba(244, 114, 182, 0.1)' 
                : 'rgba(219, 13, 206, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isTop3 
                ? 'rgba(219, 13, 206, 0.05)' 
                : isTop10 
                ? 'rgba(244, 114, 182, 0.03)' 
                : 'transparent';
            }}
          >
            <div
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: isTop3 ? '#db0dce' : isTop10 ? '#f472b6' : '#fff',
              }}
            >
              {project.rank}
            </div>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>{project.name}</div>
            <div style={{ textAlign: 'right', color: '#999', fontSize: '14px' }}>{project.score}</div>
          </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#fff' }}>
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: '700',
            margin: 0,
            background: 'linear-gradient(135deg, #db0dce 0%, #fff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Leaderboards
        </h1>
        <button
          onClick={loadLeaderboards}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: '#db0dce',
            border: '2px solid #db0dce',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
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
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '40px' }}>
        <LeaderboardTable projects={today} title="Today's Leaderboard" ref={todayRef} />
        <LeaderboardTable projects={yesterday} title="Yesterday's Leaderboard" ref={yesterdayRef} />
      </div>
    </div>
  );
}

