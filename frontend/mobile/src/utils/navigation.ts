/**
 * Standard Smart Navigation & Modal Back Interceptor Utilities (Mobile)
 * Conforms to Catavor Platform Navigation Guidelines (AGENTS.md)
 */

import { useEffect, useRef, useCallback, useState } from 'react';

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
let pendingProgrammaticPops = 0;

let originalBodyOverflow = '';
let originalHtmlOverflow = '';
let originalBodyOverscroll = '';
let originalHtmlOverscroll = '';
let isScrollLocked = false;

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (!isScrollLocked) {
    originalBodyOverflow = document.body.style.overflow || '';
    originalHtmlOverflow = document.documentElement.style.overflow || '';
    originalBodyOverscroll = document.body.style.overscrollBehavior || '';
    originalHtmlOverscroll = document.documentElement.style.overscrollBehavior || '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    isScrollLocked = true;
  }
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (isScrollLocked) {
    document.body.style.overflow = originalBodyOverflow;
    document.documentElement.style.overflow = originalHtmlOverflow;
    document.body.style.overscrollBehavior = originalBodyOverscroll;
    document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
    isScrollLocked = false;
  }
}

function notifyModalStackChange() {
  if (typeof window === 'undefined') return;
  const isOpen = modalStack.length > 0;
  if (isOpen) {
    lockBodyScroll();
  } else {
    unlockBodyScroll();
  }
  window.dispatchEvent(
    new CustomEvent('catavor:modal-stack-change', {
      detail: { count: modalStack.length, isOpen }
    })
  );
}

function ensurePopstateListener() {
  if (isPopstateListenerActive || typeof window === 'undefined') return;

  window.addEventListener('popstate', (event) => {
    // If popstate was triggered by our own modal cleanup popping its own dummy entry,
    // consume the pop and do NOT pop or close any parent modal from the stack!
    if (pendingProgrammaticPops > 0) {
      pendingProgrammaticPops--;
      if (pendingProgrammaticPops === 0) {
        window.__catavor_is_modal_popping = false;
      }
      return;
    }

    if (window.__catavor_is_modal_popping) {
      return;
    }

    // If there is an open modal on the stack, intercept popstate to close the topmost modal
    if (modalStack.length > 0) {
      const topModal = modalStack.pop();
      if (topModal) {
        notifyModalStackChange();
        isInternalBackTriggered = true;
        window.__catavor_is_modal_popping = true;
        try {
          topModal.onClose();
        } catch (err) {
          console.error('[MobileModalBackHandler] Error closing modal on back:', err);
        }
        setTimeout(() => {
          window.__catavor_is_modal_popping = false;
        }, 120);
        // Modal closed; prevent page navigation
        return;
      }
    }
  });

  isPopstateListenerActive = true;
}

declare global {
  interface Window {
    __catavor_internal_nav_count?: number;
    __catavor_nav_initialized?: boolean;
    __catavor_is_modal_popping?: boolean;
  }
}

const SESSION_DEPTH_KEY = 'catavor_session_history_depth';

export function getSessionHistoryDepth(): number {
  if (typeof window === 'undefined') return 1;
  const raw = sessionStorage.getItem(SESSION_DEPTH_KEY);
  const parsed = raw ? parseInt(raw, 10) : 1;
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

export function setSessionHistoryDepth(depth: number): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_DEPTH_KEY, String(Math.max(1, depth)));
}

export function initNavigationTracker(): void {
  if (typeof window === 'undefined' || window.__catavor_nav_initialized) return;
  window.__catavor_nav_initialized = true;

  if (typeof window.__catavor_internal_nav_count !== 'number') {
    window.__catavor_internal_nav_count = 0;
  }

  // Intercept pushState to track forward navigation within the SPA
  const originalPushState = window.history.pushState;
  window.history.pushState = function (...args) {
    const stateObj = args[0];
    const isModal = stateObj && typeof stateObj === 'object' && stateObj.__catavor_modal;
    
    if (!isModal) {
      const newDepth = getSessionHistoryDepth() + 1;
      setSessionHistoryDepth(newDepth);
      if (stateObj && typeof stateObj === 'object') {
        stateObj.__catavor_depth = newDepth;
      }
    }

    if (typeof window.__catavor_internal_nav_count === 'number') {
      window.__catavor_internal_nav_count += 1;
    }
    return originalPushState.apply(this, args);
  };

  // On popstate, adjust navigation count & session depth
  window.addEventListener('popstate', (e) => {
    if (e.state && typeof e.state.__catavor_depth === 'number') {
      setSessionHistoryDepth(e.state.__catavor_depth);
    } else {
      const cur = getSessionHistoryDepth();
      if (cur > 1) setSessionHistoryDepth(cur - 1);
    }

    if (typeof window.__catavor_internal_nav_count === 'number' && window.__catavor_internal_nav_count > 0) {
      window.__catavor_internal_nav_count -= 1;
    }
  });
}

// Auto-init on script load
if (typeof window !== 'undefined') {
  initNavigationTracker();
}

/**
 * Execute smart back navigation:
 * 1. If internal history exists within the current session, call window.history.back()
 * 2. If opened directly / cold start, fallback safely to semantic parent
 */
export function smartBack(fallback: string | (() => void) = '/'): void {
  if (typeof window === 'undefined') return;

  initNavigationTracker();

  const internalCount = window.__catavor_internal_nav_count ?? 0;
  const sessionDepth = getSessionHistoryDepth();
  const stateDepth = window.history.state?.__catavor_depth;

  const hasInternalHistory = (
    sessionDepth > 1 ||
    (typeof stateDepth === 'number' && stateDepth > 1) ||
    internalCount > 0 ||
    (window.history.length > 2 && Boolean(window.history.state))
  );

  if (hasInternalHistory) {
    window.history.back();
  } else {
    // Fallback to semantic parent
    if (typeof fallback === 'function') {
      fallback();
    } else if (typeof fallback === 'string') {
      const targetUrl = fallback.startsWith('/') ? fallback : '/' + fallback;
      window.history.replaceState({}, '', targetUrl);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    }
  }
}

/**
 * React Hook for buttons with "Kembali" / "Back" action.
 */
export function useSmartBack(fallback: string | (() => void) = '/') {
  return useCallback(() => {
    smartBack(fallback);
  }, [fallback]);
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
    window.history.pushState({ modalKey: uniqueKey, __catavor_modal: true }, '');

    const entry: ModalEntry = {
      id: modalId,
      stateKey: uniqueKey,
      onClose: () => {
        onCloseRef.current();
      },
    };
    modalStack.push(entry);
    notifyModalStackChange();

    return () => {
      // Cleanup when unmounting or modal closes
      const index = modalStack.findIndex((m) => m.stateKey === uniqueKey);
      if (index !== -1) {
        modalStack.splice(index, 1);
        notifyModalStackChange();
      }

      // If closed by UI action (click ✕ or backdrop, not via popstate), pop the dummy history entry
      if (!isInternalBackTriggered && window.history.state?.modalKey === uniqueKey) {
        pendingProgrammaticPops++;
        window.__catavor_is_modal_popping = true;
        window.history.back();
        setTimeout(() => {
          if (pendingProgrammaticPops > 0) {
            pendingProgrammaticPops--;
          }
          if (pendingProgrammaticPops === 0) {
            window.__catavor_is_modal_popping = false;
          }
        }, 400);
      }
      isInternalBackTriggered = false;
    };
  }, [isOpen, modalId, disabled]);
}

/**
 * Procedural helper to setup a modal back interceptor within a useEffect cleanup cycle (Mobile).
 */
export function setupModalBackInterceptor(onClose: () => void, modalId: string = 'mobile_modal'): () => void {
  if (typeof window === 'undefined') return () => {};

  ensurePopstateListener();

  const uniqueKey = `modal_${modalId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  window.history.pushState({ modalKey: uniqueKey, __catavor_modal: true }, '');

  const entry: ModalEntry = {
    id: modalId,
    stateKey: uniqueKey,
    onClose,
  };
  modalStack.push(entry);
  notifyModalStackChange();

  return () => {
    const index = modalStack.findIndex((m) => m.stateKey === uniqueKey);
    if (index !== -1) {
      modalStack.splice(index, 1);
      notifyModalStackChange();
    }
    if (!isInternalBackTriggered && window.history.state?.modalKey === uniqueKey) {
      pendingProgrammaticPops++;
      window.__catavor_is_modal_popping = true;
      window.history.back();
      setTimeout(() => {
        if (pendingProgrammaticPops > 0) {
          pendingProgrammaticPops--;
        }
        if (pendingProgrammaticPops === 0) {
          window.__catavor_is_modal_popping = false;
        }
      }, 400);
    }
    isInternalBackTriggered = false;
  };
}

/**
 * Checks whether any modal, bottom sheet, or drawer is currently active.
 */
export function isAnyModalOpen(): boolean {
  return modalStack.length > 0;
}

/**
 * Reactive React Hook to track whether any modal, bottom sheet, or drawer is currently open.
 * Use this to conditionally hide page-level floating elements (e.g. Scroll to Top button).
 */
export function useIsAnyModalOpen(): boolean {
  const [isOpen, setIsOpen] = useState(() => (typeof window !== 'undefined' ? modalStack.length > 0 : false));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: any) => {
      setIsOpen(e.detail?.isOpen ?? (modalStack.length > 0));
    };
    window.addEventListener('catavor:modal-stack-change', handler);
    setIsOpen(modalStack.length > 0);
    return () => {
      window.removeEventListener('catavor:modal-stack-change', handler);
    };
  }, []);

  return isOpen;
}


