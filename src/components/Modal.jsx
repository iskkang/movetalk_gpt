export default function Modal({ title, children, onClose }) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button style={closeStyle} onClick={onClose} aria-label="close modal">
          ×
        </button>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.25rem" }}>{title}</h2>
        <div>{children}</div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 900,
};

const modalStyle = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  borderRadius: 24,
  padding: 24,
  position: "relative",
  boxShadow: "0 30px 60px rgba(15, 23, 42, 0.2)",
};

const closeStyle = {
  position: "absolute",
  right: 14,
  top: 14,
  border: "none",
  background: "transparent",
  fontSize: 24,
  lineHeight: 1,
};
