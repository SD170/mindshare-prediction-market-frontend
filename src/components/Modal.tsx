import { useEffect, useRef } from 'react';
// animejs v4 uses dynamic import

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  type?: 'default' | 'success' | 'error' | 'loading';
  showCloseButton?: boolean;
}

export const Modal = ({ isOpen, onClose, title, children, type = 'default', showCloseButton = true }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      import('animejs').then(({ animate }) => {
        const overlay = overlayRef.current;
        const modal = modalRef.current;
        if (overlay) {
          animate(overlay, {
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuad',
          });
        }
        if (modal) {
          animate(modal, {
            scale: [0.9, 1],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuad',
          });
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'loading':
        return '#db0dce';
      default:
        return '#db0dce';
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: '#000',
          border: `2px solid ${getBorderColor()}`,
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: `0 0 30px ${getBorderColor()}40`,
        }}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a1a';
              e.currentTarget.style.color = '#db0dce';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#fff';
            }}
          >
            ×
          </button>
        )}
        {title && (
          <h2
            style={{
              margin: '0 0 24px 0',
              color: '#fff',
              fontSize: '24px',
              fontWeight: '600',
              borderBottom: `2px solid ${getBorderColor()}`,
              paddingBottom: '12px',
            }}
          >
            {title}
          </h2>
        )}
        <div style={{ color: '#fff' }}>{children}</div>
      </div>
    </div>
  );
};

interface LoadingModalProps {
  isOpen: boolean;
  message?: string;
}

export const LoadingModal = ({ isOpen, message = 'Processing...' }: LoadingModalProps) => {
  const spinnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && spinnerRef.current) {
      import('animejs').then(({ animate }) => {
        const spinner = spinnerRef.current;
        if (spinner) {
          animate(spinner, {
          rotate: 360,
          duration: 1000,
          loop: true,
          easing: 'linear',
          });
        }
      });
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={() => {}} type="loading" showCloseButton={false}>
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div
          ref={spinnerRef}
          style={{
            width: '60px',
            height: '60px',
            border: '4px solid #1a1a1a',
            borderTop: '4px solid #db0dce',
            borderRadius: '50%',
            margin: '0 auto 24px',
          }}
        />
        <p style={{ color: '#fff', fontSize: '18px', margin: 0 }}>{message}</p>
      </div>
    </Modal>
  );
};

