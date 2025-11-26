import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
// animejs v4 uses dynamic import

export const Home = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
          }}
        >
          Bet on which projects will dominate the social mindshare leaderboard.
          <br />
          Win big when your predictions come true.
        </p>

        <div ref={ctaRef} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
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

