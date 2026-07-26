import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}

/**
 * Модалка нового дизайна. Рендерит overlay + карточку с шапкой и кнопкой закрытия.
 * Тело/футер задаёт вызывающий (обычно `.modalBody` + `.modalFooter`, при необходимости
 * обёрнутые в `<form className="modalForm">` для sticky-футера и submit).
 * Закрывается по Esc и клику по overlay.
 */
export function Modal({ open, title, onClose, children, widthClassName }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modalOverlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className={`modalCard ${widthClassName ?? ""}`.trim()}
            initial={{ y: 14, scale: 0.985, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 14, scale: 0.985, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="modalHeader">
              {title ? <div className="modalTitle">{title}</div> : <div />}
              <button className="modalClose" type="button" onClick={onClose} aria-label="Закрыть">
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
