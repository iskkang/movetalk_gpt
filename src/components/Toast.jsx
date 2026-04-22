import { useEffect } from "react";

const toneMap = {
  error: { bg: "#dc2626", fg: "#fff" },
  warning: { bg: "#facc15", fg: "#1f2937" },
  success: { bg: "#16a34a", fg: "#fff" },
};

export default function Toast({ message, type = "error", visible, onHide }) {
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onHide?.();
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [visible, onHide]);

  if (!visible || !message) {
    return null;
  }

  const tone = toneMap[type] || toneMap.error;

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "12px 18px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        fontWeight: 700,
        zIndex: 1000,
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
      }}
    >
      {message}
    </div>
  );
}
