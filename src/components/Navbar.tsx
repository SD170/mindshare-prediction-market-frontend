import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useEffect, useRef } from 'react';
// animejs v4 uses dynamic import

export const Navbar = () => {
  const { account, connect, disconnect, isConnected } = useWallet();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (navRef.current) {
      import('animejs').then(({ animate }) => {
        const nav = navRef.current;
        if (nav) {
          animate(nav, {
          opacity: [0, 1],
          translateY: [-20, 0],
          duration: 600,
          easing: 'easeOutQuad',
          });
        }
      });
    }
  }, []);

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/markets', label: 'Markets' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/faucet', label: 'Faucet' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      ref={navRef}
      style={{
        backgroundColor: '#000',
        borderBottom: '2px solid #db0dce',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 20px rgba(219, 13, 206, 0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Link
          to="/"
          style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#db0dce',
            textDecoration: 'none',
            letterSpacing: '1px',
          }}
        >
          Mindshare
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                padding: '8px 16px',
                color: isActive(item.path) ? '#db0dce' : '#fff',
                textDecoration: 'none',
                border: isActive(item.path) ? '2px solid #db0dce' : '2px solid transparent',
                borderRadius: '6px',
                transition: 'all 0.2s',
                fontWeight: isActive(item.path) ? '600' : '400',
                backgroundColor: isActive(item.path) ? 'rgba(219, 13, 206, 0.1)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.borderColor = '#db0dce';
                  e.currentTarget.style.backgroundColor = 'rgba(219, 13, 206, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div>
        {!isConnected ? (
          <button
            onClick={connect}
            style={{
              padding: '10px 24px',
              backgroundColor: '#db0dce',
              color: '#fff',
              border: '2px solid #db0dce',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#b80bb8';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(219, 13, 206, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#db0dce';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Connect Wallet
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                color: '#fff',
                fontSize: '14px',
                padding: '8px 16px',
                border: '2px solid #db0dce',
                borderRadius: '6px',
                backgroundColor: 'rgba(219, 13, 206, 0.1)',
              }}
            >
              {account?.slice(0, 6)}...{account?.slice(-4)}
            </span>
            <button
              onClick={disconnect}
              style={{
                padding: '10px 24px',
                backgroundColor: 'transparent',
                color: '#db0dce',
                border: '2px solid #db0dce',
                borderRadius: '6px',
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
              Disconnect
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

