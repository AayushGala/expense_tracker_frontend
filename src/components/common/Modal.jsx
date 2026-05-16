import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// A simple counter so multiple open modals share one body-overflow lock.
// Without this, closing modal A while modal B is still open would let the
// page scroll behind B.
let openCount = 0;

function lockBodyScroll() {
  if (openCount === 0) document.body.style.overflow = 'hidden';
  openCount += 1;
}

function unlockBodyScroll() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.body.style.overflow = '';
}

export default function Modal({ isOpen, onClose, children, title, maxWidth = 'max-w-lg' }) {
  // Only the topmost modal closes on ESC — see useEscapeKey for the stack
  // mechanic. Focus is trapped inside the panel while open; on close, focus
  // restores to whatever element had it before opening.
  useEscapeKey(isOpen, onClose);
  const panelRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative z-10 w-full ${maxWidth} rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] ring-1 ring-gray-200/60`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title !== undefined) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-xl hover:bg-gray-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
