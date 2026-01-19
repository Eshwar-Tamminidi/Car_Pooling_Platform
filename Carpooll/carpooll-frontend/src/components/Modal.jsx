import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ show, onClose, children, maxWidth = 620 }) {
  useEffect(() => {
    if (show) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");

    return () => document.body.classList.remove("modal-open");
  }, [show]);

  if (!show) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      style={{
        background: "var(--modal-overlay)",
        backdropFilter: "blur(6px)",
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth,
          width: "100%",
          borderRadius: "16px",
          padding: "24px",
          background: "var(--modal-bg)",
          color: "var(--text)",
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
