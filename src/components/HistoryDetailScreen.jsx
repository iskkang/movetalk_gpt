import { useEffect, useState } from "react";
import SubtitleCard from "./SubtitleCard";
import { getSessionDetail } from "../utils/api";

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

export default function HistoryDetailScreen({ sessionId, onBack }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadDetail = async () => {
      setIsLoading(true);
      setError("");

      try {
        const result = await getSessionDetail(sessionId);
        if (isMounted) {
          setSession(result);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "상세 기록을 불러오지 못했습니다.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  return (
    <section style={screenStyle}>
      <header style={topBarStyle}>
        <button style={navButtonStyle} onClick={onBack}>
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: "1.15rem" }}>상세 기록</h1>
        <div style={{ width: 40 }} />
      </header>

      {isLoading && <div style={infoCardStyle}>불러오는 중...</div>}
      {!isLoading && error && <div style={infoCardStyle}>{error}</div>}

      {!isLoading && !error && session && (
        <>
          <div style={infoCardStyle}>
            <h2 style={{ marginTop: 0 }}>{session.sessionTitle}</h2>
            <p style={metaTextStyle}>연락처: {session.contactName}</p>
            {session.companyName ? <p style={metaTextStyle}>회사: {session.companyName}</p> : null}
            <p style={metaTextStyle}>일시: {formatDateTime(session.createdAt)}</p>
            <p style={metaTextStyle}>
              언어: {session.sourceLang?.toUpperCase()}→{session.targetLang?.toUpperCase()}
            </p>
            <p style={metaTextStyle}>메시지 수: {session.totalMessages ?? 0}</p>
            <p style={{ ...metaTextStyle, marginBottom: 0 }}>대화 시간: {session.duration || "진행 중"}</p>
          </div>

          <div style={messagesStyle}>
            {session.messages?.map((message) => (
              <SubtitleCard
                key={message.id}
                speaker={message.speakerRole}
                timestamp={message.timestamp}
                originalText={message.originalText}
                translatedText={message.translatedText}
                readOnly
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const screenStyle = {
  minHeight: "100%",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 16,
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

const infoCardStyle = {
  background: "#fff",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.08)",
};

const metaTextStyle = {
  margin: "0 0 6px",
  color: "#475569",
};

const messagesStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  overflowY: "auto",
  paddingBottom: 12,
};
