function formatClock(timestamp) {
  if (!timestamp) {
    return "--:--";
  }

  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function SubtitleCard({
  speaker,
  timestamp,
  originalText,
  translatedText,
  failed = false,
  onRetry,
  readOnly = false,
}) {
  const isMe = speaker === "me";
  const label = isMe ? "나" : "상대방";

  return (
    <div
      style={{
        alignSelf: isMe ? "flex-end" : "flex-start",
        width: "min(92%, 420px)",
        background: failed ? "#fee2e2" : "#fff",
        borderLeft: `6px solid ${isMe ? "#1e40af" : "#c2410c"}`,
        borderRadius: 20,
        padding: 16,
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "#64748b", fontWeight: 600 }}>{formatClock(timestamp)}</span>
      </div>
      {failed && (
        <div
          style={{
            display: "inline-flex",
            marginBottom: 8,
            padding: "4px 10px",
            borderRadius: 999,
            background: "#dc2626",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          전송 실패
        </div>
      )}
      <div style={{ color: "#64748b", fontSize: 14, marginBottom: 10 }}>{originalText}</div>
      <div style={{ color: "#111827", fontWeight: 800, fontSize: 20, lineHeight: 1.4 }}>
        {translatedText}
      </div>
      {failed && !readOnly && (
        <button
          style={{
            marginTop: 14,
            border: "none",
            borderRadius: 12,
            padding: "10px 12px",
            background: "#b91c1c",
            color: "#fff",
            fontWeight: 700,
            width: "100%",
          }}
          onClick={onRetry}
        >
          재시도
        </button>
      )}
    </div>
  );
}
