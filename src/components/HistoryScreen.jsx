import { useEffect, useState } from "react";
import { getSessions } from "../utils/api";
import { getCopy } from "../utils/i18n";

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toBadge(sourceLang, targetLang) {
  return `${sourceLang?.toUpperCase() || "--"}→${targetLang?.toUpperCase() || "--"}`;
}

export default function HistoryScreen({ uiLang, onBack, onOpenDetail }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const text = getCopy(uiLang);

  const loadSessions = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await getSessions();
      setSessions(response);
    } catch (loadError) {
      setError(loadError.message || text.historyLoadError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [uiLang]);

  return (
    <section style={screenStyle}>
      <header style={topBarStyle}>
        <button style={navButtonStyle} onClick={onBack}>
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{text.historyTitle}</h1>
        <div style={{ width: 40 }} />
      </header>

      {isLoading && <div style={stateCardStyle}>{text.loading}</div>}

      {!isLoading && error && (
        <div style={stateCardStyle}>
          <p style={{ marginTop: 0 }}>{error}</p>
          <button style={retryButtonStyle} onClick={loadSessions}>
            {text.retry}
          </button>
        </div>
      )}

      {!isLoading && !error && sessions.length === 0 && (
        <div style={stateCardStyle}>{text.historyEmpty}</div>
      )}

      {!isLoading && !error && sessions.length > 0 && (
        <div style={listStyle}>
          {sessions.map((session) => (
            <button
              key={session.id}
              style={sessionCardStyle}
              onClick={() => onOpenDetail(session.id)}
            >
              <div style={{ display: "grid", gap: 6, textAlign: "left" }}>
                <strong style={{ fontSize: 20 }}>{session.contactName}</strong>
                {session.companyName ? (
                  <span style={{ color: "#64748b", fontSize: 14 }}>{session.companyName}</span>
                ) : null}
                <span style={{ color: "#334155", fontSize: 13 }}>{session.sessionTitle}</span>
                <span style={{ color: "#475569", fontSize: 13 }}>
                  {formatDateTime(session.createdAt)}
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={badgeStyle}>{toBadge(session.sourceLang, session.targetLang)}</span>
                  <span style={metaStyle}>
                    {text.messageCountCompact} {session.totalMessages ?? 0}
                  </span>
                  <span style={metaStyle}>{session.duration || text.inProgress}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const screenStyle = {
  minHeight: "100%",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const topBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const navButtonStyle = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: "none",
  background: "#e2e8f0",
  fontSize: 20,
};

const stateCardStyle = {
  background: "#fff",
  borderRadius: 20,
  padding: 24,
  color: "#334155",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
};

const listStyle = {
  display: "grid",
  gap: 14,
  overflowY: "auto",
  paddingBottom: 12,
};

const sessionCardStyle = {
  border: "none",
  background: "#fff",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.08)",
};

const badgeStyle = {
  borderRadius: 999,
  background: "#dbeafe",
  color: "#1d4ed8",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
};

const metaStyle = {
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#334155",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 700,
};

const retryButtonStyle = {
  border: "none",
  background: "#0f172a",
  color: "#fff",
  padding: "12px 16px",
  borderRadius: 14,
  fontWeight: 700,
};
