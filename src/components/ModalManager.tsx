import { Modal, LoadingModal } from './Modal';

interface ModalManagerProps {
  modal: {
    isOpen: boolean;
    type: 'success' | 'error' | 'confirm' | 'loading' | 'info';
    title?: string;
    message?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  };
  onClose: () => void;
}

export const ModalManager = ({ modal, onClose }: ModalManagerProps) => {
  if (modal.type === 'loading') {
    return <LoadingModal isOpen={modal.isOpen} message={modal.message} />;
  }

  if (modal.type === 'confirm') {
    return (
      <Modal
        isOpen={modal.isOpen}
        onClose={onClose}
        title={modal.title || 'Confirm'}
        type="default"
        showCloseButton={false}
      >
        <div style={{ marginBottom: '24px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
          {modal.message}
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={modal.onCancel || onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: 'transparent',
              color: '#db0dce',
              border: '2px solid #db0dce',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(219, 13, 206, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </button>
          <button
            onClick={modal.onConfirm || onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: '#db0dce',
              color: '#fff',
              border: '2px solid #db0dce',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#b80bb8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#db0dce';
            }}
          >
            Confirm
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={modal.isOpen}
      onClose={onClose}
      title={modal.title}
      type={modal.type === 'success' ? 'success' : modal.type === 'error' ? 'error' : 'default'}
    >
      <div style={{ lineHeight: '1.6', whiteSpace: 'pre-line' }}>{modal.message}</div>
    </Modal>
  );
};

