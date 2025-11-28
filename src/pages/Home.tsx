import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
// animejs v4 uses dynamic import

export const Home = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Neural network / brain-style background animations
    import('animejs').then(({ animate }) => {
      if (backgroundRef.current) {
        const nodes = backgroundRef.current.querySelectorAll('.neural-node');
        const particles = backgroundRef.current.querySelectorAll('.neural-particle');
        
        // Animate nodes (neurons) - pulsing and glowing
        nodes.forEach((node, index) => {
          // Pulsing scale animation
          animate(node, {
            scale: [1, 1.3, 1],
            duration: 2000 + index * 300,
            easing: 'easeInOutSine',
            loop: true,
            delay: index * 200,
          });
          
          // Opacity glow effect
          animate(node, {
            opacity: [0.4, 0.8, 0.4],
            duration: 1500 + index * 200,
            easing: 'easeInOutSine',
            loop: true,
            delay: index * 150,
          });
        });
        
        // Connections are animated via CSS (see style tag in component)
        
        // Animate particles flowing along connections
        particles.forEach((particle, index) => {
          animate(particle, {
            translateX: [0, Math.random() * 400 - 200],
            translateY: [0, Math.random() * 400 - 200],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
            duration: 4000 + index * 600,
            easing: 'easeInOutSine',
            loop: true,
            delay: index * 400,
          });
        });
      }
    });

    // Hero animations
    import('animejs').then(({ animate }) => {
      if (titleRef.current) {
        animate(titleRef.current, {
          opacity: [0, 1],
          translateY: [50, 0],
          duration: 1000,
          easing: 'easeOutQuad',
        });
      }

      if (subtitleRef.current) {
        animate(subtitleRef.current, {
          opacity: [0, 1],
          translateY: [30, 0],
          duration: 1000,
          delay: 200,
          easing: 'easeOutQuad',
        });
      }

      if (ctaRef.current) {
        animate(ctaRef.current, {
          opacity: [0, 1],
          scale: [0.9, 1],
          duration: 800,
          delay: 400,
          easing: 'easeOutQuad',
        });
      }
    });

    // Scroll animations for features
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            import('animejs').then(({ animate }) => {
              animate(entry.target, {
                opacity: [0, 1],
                translateY: [50, 0],
                duration: 800,
                easing: 'easeOutQuad',
              });
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (featuresRef.current) {
      const featureCards = featuresRef.current.querySelectorAll('.feature-card');
      featureCards.forEach((card) => observer.observe(card));
    }

    return () => {
      if (featuresRef.current) {
        const featureCards = featuresRef.current.querySelectorAll('.feature-card');
        featureCards.forEach((card) => observer.unobserve(card));
      }
    };
  }, []);

  const features = [
    {
      title: 'Predict & Win',
      description: 'Bet on which Web3 projects will rank in the top 10 or win head-to-head matchups.',
      icon: '🎯',
    },
    {
      title: 'Real-time Markets',
      description: 'Markets update daily based on the latest social mindshare leaderboard rankings.',
      icon: '📊',
    },
    {
      title: 'Fair Payouts',
      description: 'Parimutuel betting ensures transparent, pro-rata payouts for all winners.',
      icon: '💰',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>
      <style>{`
        @keyframes neuralFlow {
          0% {
            stroke-dashoffset: 1000;
          }
          100% {
            stroke-dashoffset: -1000;
          }
        }
        .neural-connection {
          stroke-dasharray: 20 10;
          animation: neuralFlow 4s linear infinite;
        }
        .neural-connection:nth-child(1) { animation-duration: 3s; animation-delay: 0s; }
        .neural-connection:nth-child(2) { animation-duration: 3.5s; animation-delay: 0.3s; }
        .neural-connection:nth-child(3) { animation-duration: 4s; animation-delay: 0.6s; }
        .neural-connection:nth-child(4) { animation-duration: 3.2s; animation-delay: 0.2s; }
        .neural-connection:nth-child(5) { animation-duration: 3.8s; animation-delay: 0.4s; }
        .neural-connection:nth-child(6) { animation-duration: 4.2s; animation-delay: 0.8s; }
        .neural-connection:nth-child(7) { animation-duration: 3.5s; animation-delay: 0.1s; }
        .neural-connection:nth-child(8) { animation-duration: 3.7s; animation-delay: 0.5s; }
        .neural-connection:nth-child(9) { animation-duration: 4s; animation-delay: 0.7s; }
        .neural-connection:nth-child(10) { animation-duration: 3.3s; animation-delay: 0.2s; }
      `}</style>
      {/* Hero Section */}
      <section
        ref={heroRef}
        style={{
          minHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '80px 32px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, #000 0%, #1a0a1a 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Neural Network / Brain-style Background */}
        <div
          ref={backgroundRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          {/* SVG for neural connections */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
            }}
          >
            {/* Neural pathways/connections */}
            <path
              className="neural-connection"
              d="M 15% 20% Q 25% 15%, 35% 20% T 50% 25%"
              stroke="rgba(219, 13, 206, 0.3)"
              strokeWidth="2"
              fill="none"
            />
            <path
              className="neural-connection"
              d="M 20% 40% Q 30% 35%, 40% 40% T 55% 45%"
              stroke="rgba(219, 13, 206, 0.25)"
              strokeWidth="2"
              fill="none"
            />
            <path
              className="neural-connection"
              d="M 25% 60% Q 35% 55%, 45% 60% T 60% 65%"
              stroke="rgba(219, 13, 206, 0.3)"
              strokeWidth="2"
              fill="none"
            />
            <path
              className="neural-connection"
              d="M 50% 25% Q 60% 30%, 70% 35% T 85% 40%"
              stroke="rgba(219, 13, 206, 0.25)"
              strokeWidth="2"
              fill="none"
            />
            <path
              className="neural-connection"
              d="M 45% 50% Q 55% 45%, 65% 50% T 80% 55%"
              stroke="rgba(219, 13, 206, 0.3)"
              strokeWidth="2"
              fill="none"
            />
            <path
              className="neural-connection"
              d="M 30% 75% Q 40% 70%, 50% 75% T 70% 80%"
              stroke="rgba(219, 13, 206, 0.25)"
              strokeWidth="2"
              fill="none"
            />
            <path
              className="neural-connection"
              d="M 15% 50% Q 20% 45%, 25% 50% Q 30% 55%, 35% 50%"
              stroke="rgba(219, 13, 206, 0.2)"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              className="neural-connection"
              d="M 65% 20% Q 70% 25%, 75% 30% Q 80% 35%, 85% 40%"
              stroke="rgba(219, 13, 206, 0.2)"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              className="neural-connection"
              d="M 40% 30% Q 50% 35%, 60% 40% Q 70% 45%, 75% 50%"
              stroke="rgba(219, 13, 206, 0.25)"
              strokeWidth="2"
              fill="none"
            />
            <path
              className="neural-connection"
              d="M 20% 70% Q 35% 65%, 50% 70% Q 65% 75%, 80% 80%"
              stroke="rgba(219, 13, 206, 0.3)"
              strokeWidth="2"
              fill="none"
            />
          </svg>

          {/* Neural nodes (neurons) - positioned in brain-like clusters */}
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '15%',
              left: '15%',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 20px rgba(219, 13, 206, 0.6), 0 0 40px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '20%',
              left: '35%',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 15px rgba(219, 13, 206, 0.5), 0 0 30px rgba(219, 13, 206, 0.2)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '25%',
              left: '50%',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 25px rgba(219, 13, 206, 0.7), 0 0 50px rgba(219, 13, 206, 0.4)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '40%',
              left: '20%',
              width: '11px',
              height: '11px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 18px rgba(219, 13, 206, 0.5), 0 0 35px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '40%',
              left: '40%',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 22px rgba(219, 13, 206, 0.6), 0 0 45px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '45%',
              left: '55%',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 15px rgba(219, 13, 206, 0.5), 0 0 30px rgba(219, 13, 206, 0.2)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '50%',
              left: '25%',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 20px rgba(219, 13, 206, 0.6), 0 0 40px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '60%',
              left: '45%',
              width: '11px',
              height: '11px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 18px rgba(219, 13, 206, 0.5), 0 0 35px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '65%',
              left: '60%',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 22px rgba(219, 13, 206, 0.6), 0 0 45px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '30%',
              left: '70%',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 20px rgba(219, 13, 206, 0.6), 0 0 40px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '35%',
              left: '85%',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 15px rgba(219, 13, 206, 0.5), 0 0 30px rgba(219, 13, 206, 0.2)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '50%',
              left: '75%',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 25px rgba(219, 13, 206, 0.7), 0 0 50px rgba(219, 13, 206, 0.4)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '55%',
              left: '80%',
              width: '11px',
              height: '11px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 18px rgba(219, 13, 206, 0.5), 0 0 35px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '75%',
              left: '30%',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 20px rgba(219, 13, 206, 0.6), 0 0 40px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '80%',
              left: '50%',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 22px rgba(219, 13, 206, 0.6), 0 0 45px rgba(219, 13, 206, 0.3)',
            }}
          />
          <div
            className="neural-node"
            style={{
              position: 'absolute',
              top: '80%',
              left: '70%',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #db0dce 0%, rgba(219, 13, 206, 0.3) 70%)',
              boxShadow: '0 0 15px rgba(219, 13, 206, 0.5), 0 0 30px rgba(219, 13, 206, 0.2)',
            }}
          />

          {/* Flowing particles along connections */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="neural-particle"
              style={{
                position: 'absolute',
                top: `${15 + i * 8}%`,
                left: `${20 + i * 7}%`,
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: '#db0dce',
                boxShadow: '0 0 10px rgba(219, 13, 206, 0.8), 0 0 20px rgba(219, 13, 206, 0.4)',
              }}
            />
          ))}
        </div>

        {/* Gradient blurs */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(219, 13, 206, 0.3) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(60px)',
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '20%',
            right: '10%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(219, 13, 206, 0.2) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(80px)',
            zIndex: 1,
          }}
        />

        <h1
          ref={titleRef}
          style={{
            fontSize: 'clamp(48px, 8vw, 96px)',
            fontWeight: '800',
            margin: '0 0 24px 0',
            background: 'linear-gradient(135deg, #db0dce 0%, #fff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: '1.1',
            letterSpacing: '-2px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          Predict the future
          <br />
          of Web3 projects
        </h1>

        <p
          ref={subtitleRef}
          style={{
            fontSize: 'clamp(18px, 2.5vw, 24px)',
            color: '#ccc',
            maxWidth: '700px',
            margin: '0 0 48px 0',
            lineHeight: '1.6',
            position: 'relative',
            zIndex: 2,
          }}
        >
          Bet on which projects will dominate the social mindshare leaderboard.
          <br />
          Win big when your predictions come true.
        </p>

        <div ref={ctaRef} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
          <Link
            to="/markets"
            style={{
              padding: '16px 32px',
              backgroundColor: '#db0dce',
              color: '#fff',
              border: '2px solid #db0dce',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '18px',
              transition: 'all 0.3s',
              boxShadow: '0 4px 20px rgba(219, 13, 206, 0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 30px rgba(219, 13, 206, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(219, 13, 206, 0.4)';
            }}
          >
            View Markets
          </Link>
          <Link
            to="/leaderboard"
            style={{
              padding: '16px 32px',
              backgroundColor: 'transparent',
              color: '#db0dce',
              border: '2px solid #db0dce',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '18px',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#db0dce';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#db0dce';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            See Leaderboard
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section
        ref={featuresRef}
        style={{
          padding: '100px 32px',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(36px, 5vw, 48px)',
            fontWeight: '700',
            textAlign: 'center',
            margin: '0 0 64px 0',
            color: '#fff',
          }}
        >
          How it works
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '32px',
          }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-card"
              style={{
                padding: '40px',
                border: '2px solid #db0dce',
                borderRadius: '12px',
                backgroundColor: '#0a0a0a',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(219, 13, 206, 0.3)';
                e.currentTarget.style.borderColor = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#db0dce';
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>{feature.icon}</div>
              <h3
                style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  margin: '0 0 12px 0',
                  color: '#db0dce',
                }}
              >
                {feature.title}
              </h3>
              <p style={{ fontSize: '16px', color: '#ccc', lineHeight: '1.6', margin: 0 }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

