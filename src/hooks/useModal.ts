import { useState, useCallback } from 'react';

interface ModalState {
  isOpen: boolean;
  type: 'success' | 'error' | 'confirm' | 'loading' | 'info';
  title?: string;
  message?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const useModal = () => {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: 'info',
  });

  const showModal = useCallback((config: Omit<ModalState, 'isOpen'>) => {
    setModal({ ...config, isOpen: true });
  }, []);

  const hideModal = useCallback(() => {
    setModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const showSuccess = useCallback((message: string, title?: string) => {
    showModal({ type: 'success', message, title });
  }, [showModal]);

  const showError = useCallback((message: string, title?: string) => {
    showModal({ type: 'error', message, title });
  }, [showModal]);

  const showLoading = useCallback((message?: string) => {
    showModal({ type: 'loading', message });
  }, [showModal]);

  const showConfirm = useCallback((message: string, onConfirm: () => void, title?: string) => {
    showModal({
      type: 'confirm',
      message,
      title,
      onConfirm: () => {
        onConfirm();
        hideModal();
      },
      onCancel: hideModal,
    });
  }, [showModal, hideModal]);

  return {
    modal,
    showModal,
    hideModal,
    showSuccess,
    showError,
    showLoading,
    showConfirm,
  };
};

