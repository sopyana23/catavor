/**
 * Standard Smart Navigation & Modal Back Interceptor Utilities (Mobile)
 * Conforms to Catavor Platform Navigation Guidelines (AGENTS.md)
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Global registry for active modals/drawers/bottom-sheets in LIFO order.
 */
interface ModalEntry {
  id: string;
  onClose: () => void;
  stateKey: string;
}

const modalStack: ModalEntry[] = [];
let isPopstateListenerActive = false;
let isInternalBackTriggered = false;

function ensurePopstateListener() {
  if (isPopstateListenerActive || typeof window === 'undefined') return;

  window.addEventListener('popstate', (event) => {
    // If there is an open modal on the stack, intercept popstate to close the topmost modal
    if (modalStack.length > 0) {
      const topModal = modalStack.pop();
      if (topModal) {
        isInternalBackTriggered = true;
        try {
          topModal.onClose();
        } catch (err) {
          console.error('[MobileModalBackHandler] Error closing modal on back:', err);
        }
        // Modal closed; prevent page navigation
        return;
      }
    }
  });

  isPopstateListenerActive = true;
}

/**
 * Execute smart back navigation:
 * 1. If internal history exists within the current session, call window.history.back()
 * 2. If opened directly / cold start, fallback safely to semantic parent
 */
export function smartBack(fallbackPath: string = '/'): void {
  if (typeof window === 'undefined') return;

  const hasHistory = window.history.length > 1;
  const isInternalReferrer = !!document.referrer && document.referrer.includes(window.location.host);

  if (hasHistory && (isInternalReferrer || window.history.state)) {
    window.history.back();
  } else {
    // Fallback to parent
    if (fallbackPath.startsWith('/')) {
      window.location.href = fallbackPath;
    } else {
      window.location.pathname = fallbackPath;
    }
  }
}

/**
 * React Hook for buttons with "Kembali" / "Back" action.
 */
export function useSmartBack(fallbackPath: string = '/') {
  return useCallback(() => {
    smartBack(fallbackPath);
  }, [fallbackPath]);
}

/**
 * React Hook to intercept hardware back button, browser back, and swipe gestures
 * when a mobile modal / sheet / drawer is open. Closes the modal instead of navigating away.
 */
export interface UseModalBackOptions {
  isOpen: boolean;
  onClose: () => void;
  modalId?: string;
  disabled?: boolean;
}

export function useModalBackHandler({
  isOpen,
  onClose,
  modalId = 'modal',
  disabled = false,
}: UseModalBackOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stateKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || disabled || !isOpen) return;

    ensurePopstateListener();

    const uniqueKey = `modal_${modalId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    stateKeyRef.current = uniqueKey;

    // Push dummy state to capture back button/gesture
    window.history.pushState({ modalKey: uniqueKey }, '');

    const entry: ModalEntry = {
      id: modalId,
      stateKey: uniqueKey,
      onClose: () => {
        onCloseRef.current();
      },
    };
    modalStack.push(entry);

    return () => {
      // Cleanup when unmounting or modal closes
      const index = modalStack.findIndex((m) => m.stateKey === uniqueKey);
      if (index !== -1) {
        modalStack.splice(index, 1);
      }

      // If closed by UI action (click ✕ or backdrop, not via popstate), pop the dummy history entry
      if (!isInternalBackTriggered && window.history.state?.modalKey === uniqueKey) {
        window.history.back();
      }
      isInternalBackTriggered = false;
    };
  }, [isOpen, modalId, disabled]);
}
