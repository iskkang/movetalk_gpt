import { useEffect, useRef, useState } from "react";
import SubtitleCard from "./SubtitleCard";
import Toast from "./Toast";
import Modal from "./Modal";
import { checkMicPermission, startRecording, stopRecording } from "../utils/audio";
import { endSession, transcribeAndTranslate } from "../utils/api";

function languagePair(sourceLang, targetLang) {
  return `${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}`;
}

function makeSpinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        border: "2px solid rgba(255,255,255,0.35)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

function buildFailedCard(errorMessage, speakerRole, audioBlob, sourceLang, targetLang) {
  return {
    id: `failed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    speakerRole,
    originalText: errorMessage,
    translatedText: "처리되지 않았습니다. 다시 시도해주세요.",
    timestamp: new Date().toISOString(),
    failed: true,
    audioBlob,
    sourceLang,
    targetLang,
  };
}

export default function SessionScreen({
  contactName,
  companyName,
  sourceLang,
  targetLang,
  sessionId,
  sessionTitle,
  onViewHistory,
  onStartNewSession,
}) {
  const [messages, setMessages] = useState([]);
  const [recorderState, setRecorderState] = useState({
    instance: null,
    speakerRole: null,
    startedAt: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "error", visible: false });
  const [lastAttempt, setLastAttempt] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [summary, setSummary] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const conversationRef = useRef(null);

  const showToast = (message, type = "error") => {
    setToast({ message, type, visible: true });
  };

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!conversationRef.current) {
      return;
    }

    conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
  }, [messages]);

  const submitAudio = async ({
    audioBlob,
    speakerRole,
    currentSourceLang,
    currentTargetLang,
    failedMessageId,
  }) => {
    setIsProcessing(true);
    setActiveSpeaker(speakerRole);
    setLastAttempt({ audioBlob, speakerRole, sourceLang: currentSourceLang, targetLang: currentTargetLang });

    try {
      const audioFile = new File([audioBlob], "audio.webm", {
        type: audioBlob.type || "audio/webm",
      });

      const response = await transcribeAndTranslate(
        audioFile,
        currentSourceLang,
        currentTargetLang,
        speakerRole,
        sessionId,
      );

      setMessages((prev) => {
        const next = failedMessageId ? prev.filter((item) => item.id !== failedMessageId) : prev;
        return [
          ...next,
          {
            id: response.id || `${Date.now()}`,
            speakerRole: response.speakerRole,
            originalText: response.originalText,
            translatedText: response.translatedText,
            timestamp: response.timestamp,
            failed: false,
          },
        ];
      });
    } catch (error) {
      const failure = buildFailedCard(
        error.message || "처리 중 오류가 발생했습니다. 다시 시도해주세요.",
        speakerRole,
        audioBlob,
        currentSourceLang,
        currentTargetLang,
      );

      setMessages((prev) => {
        const next = failedMessageId ? prev.filter((item) => item.id !== failedMessageId) : prev;
        return [...next, failure];
      });

      showToast(error.message || "처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
      setActiveSpeaker(null);
    }
  };

  const handlePressStart = async (speakerRole) => {
    if (isOffline) {
      showToast("인터넷 연결을 확인해주세요.", "warning");
      return;
    }

    if (isProcessing || isSessionEnded || recorderState.instance) {
      return;
    }

    const hasPermission = await checkMicPermission();
    if (!hasPermission) {
      showToast(
        "마이크 접근이 거부되었습니다. 브라우저 설정에서 허용해주세요.",
        "error",
      );
      return;
    }

    try {
      const instance = await startRecording();
      setRecorderState({
        instance,
        speakerRole,
        startedAt: Date.now(),
      });
      setActiveSpeaker(speakerRole);
    } catch (error) {
      showToast(error.message || "녹음을 시작할 수 없습니다.");
    }
  };

  const handlePressEnd = async () => {
    if (!recorderState.instance) {
      return;
    }

    const elapsed = Date.now() - recorderState.startedAt;
    const { instance, speakerRole } = recorderState;
    setRecorderState({ instance: null, speakerRole: null, startedAt: 0 });

    if (elapsed < 500) {
      try {
        await stopRecording(instance);
      } catch {
        // Ignore recorder shutdown errors when rejecting short audio.
      }
      setActiveSpeaker(null);
      showToast("너무 짧습니다. 길게 누르세요.");
      return;
    }

    try {
      const audioBlob = await stopRecording(instance);
      const direction =
        speakerRole === "me"
          ? { source: sourceLang, target: targetLang }
          : { source: targetLang, target: sourceLang };

      await submitAudio({
        audioBlob,
        speakerRole,
        currentSourceLang: direction.source,
        currentTargetLang: direction.target,
      });
    } catch (error) {
      setActiveSpeaker(null);
      showToast(error.message || "녹음 처리에 실패했습니다.");
    }
  };

  const handleRetry = async (message) => {
    if (!message.audioBlob || isProcessing) {
      return;
    }

    await submitAudio({
      audioBlob: message.audioBlob,
      speakerRole: message.speakerRole,
      currentSourceLang: message.sourceLang,
      currentTargetLang: message.targetLang,
      failedMessageId: message.id,
    });
  };

  const handleEndSession = async () => {
    if (isProcessing || isSessionEnded) {
      return;
    }

    try {
      const result = await endSession(sessionId);
      setSummary(result);
      setIsSessionEnded(true);
      setShowSummaryModal(true);
    } catch (error) {
      showToast(error.message || "세션 종료에 실패했습니다.");
    }
  };

  const handleCopyConversation = async () => {
    const lines = messages
      .filter((message) => !message.failed)
      .map((message) => {
        const speakerLabel = message.speakerRole === "me" ? "나" : "상대방";
        const time = new Date(message.timestamp).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        return `[${time}] ${speakerLabel}: ${message.originalText} / ${message.translatedText}`;
      });

    await navigator.clipboard.writeText(lines.join("\n"));
    showToast("복사되었습니다.", "success");
  };

  const canRecord =
    !isOffline && !isProcessing && !isSessionEnded && !recorderState.instance;

  return (
    <section style={screenStyle}>
      <Toast {...toast} onHide={() => setToast((prev) => ({ ...prev, visible: false }))} />

      {isOffline && (
        <div style={offlineBannerStyle}>인터넷 연결을 확인해주세요.</div>
      )}

      <header style={headerStyle}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={dotStyle} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{sessionTitle}</div>
            {companyName ? <div style={{ color: "#64748b", fontSize: 14 }}>{companyName}</div> : null}
            <div style={{ color: "#1d4ed8", fontWeight: 700, marginTop: 6 }}>
              {languagePair(sourceLang, targetLang)}
            </div>
          </div>
        </div>

        <button style={endButtonStyle} onClick={handleEndSession} disabled={isProcessing}>
          세션 종료
        </button>
      </header>

      <div style={conversationHeaderStyle}>
        <div>
          <strong>{contactName}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>실시간 자막 기록</div>
        </div>
        <button
          style={clearButtonStyle}
          onClick={() => setMessages([])}
          disabled={messages.length === 0}
        >
          자막 지우기
        </button>
      </div>

      <div ref={conversationRef} style={conversationStyle}>
        {messages.length === 0 ? (
          <div style={emptyStateStyle}>아직 기록된 자막이 없습니다.</div>
        ) : (
          messages.map((message) => (
            <SubtitleCard
              key={message.id}
              speaker={message.speakerRole}
              timestamp={message.timestamp}
              originalText={message.originalText}
              translatedText={message.translatedText}
              failed={message.failed}
              readOnly={isSessionEnded}
              onRetry={() => handleRetry(message)}
            />
          ))
        )}
      </div>

      <div style={controlsStyle}>
        <button
          style={{
            ...speakerButtonStyle("#2563eb"),
            ...(activeSpeaker === "me" && recorderState.instance ? recordingStyle : {}),
          }}
          disabled={!canRecord && !(recorderState.instance && recorderState.speakerRole === "me")}
          onMouseDown={() => handlePressStart("me")}
          onMouseUp={handlePressEnd}
          onMouseLeave={() => {
            if (recorderState.speakerRole === "me") {
              handlePressEnd();
            }
          }}
          onTouchStart={() => handlePressStart("me")}
          onTouchEnd={handlePressEnd}
        >
          {isProcessing && activeSpeaker === "me" ? makeSpinner() : "나 말하기"}
        </button>

        <button
          style={{
            ...speakerButtonStyle("#ea580c"),
            ...(activeSpeaker === "other" && recorderState.instance ? recordingStyle : {}),
          }}
          disabled={
            !canRecord && !(recorderState.instance && recorderState.speakerRole === "other")
          }
          onMouseDown={() => handlePressStart("other")}
          onMouseUp={handlePressEnd}
          onMouseLeave={() => {
            if (recorderState.speakerRole === "other") {
              handlePressEnd();
            }
          }}
          onTouchStart={() => handlePressStart("other")}
          onTouchEnd={handlePressEnd}
        >
          {isProcessing && activeSpeaker === "other" ? makeSpinner() : "상대방 말하기"}
        </button>
      </div>

      {showSummaryModal && (
        <Modal title="세션 요약" onClose={() => setShowSummaryModal(false)}>
          <div style={{ display: "grid", gap: 10 }}>
            <strong>{sessionTitle}</strong>
            <span>메시지 수: {summary?.totalMessages ?? messages.filter((item) => !item.failed).length}</span>
            <span>대화 시간: {summary?.duration || "진행 중"}</span>
            <button style={modalButtonStyle("#0f172a")} onClick={handleCopyConversation}>
              대화 내용 복사
            </button>
            <button
              style={modalButtonStyle("#2563eb")}
              onClick={() => {
                setShowSummaryModal(false);
                onViewHistory();
              }}
            >
              대화 기록 보기
            </button>
            <button style={modalButtonStyle("#16a34a")} onClick={onStartNewSession}>
              새 세션 시작
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

const screenStyle = {
  minHeight: "100%",
  padding: 18,
  display: "grid",
  gap: 14,
  gridTemplateRows: "auto auto 1fr auto",
};

const offlineBannerStyle = {
  background: "#fde047",
  color: "#1f2937",
  borderRadius: 16,
  padding: "12px 14px",
  fontWeight: 700,
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  background: "#fff",
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.08)",
};

const dotStyle = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  background: "#22c55e",
  marginTop: 6,
  boxShadow: "0 0 0 5px rgba(34, 197, 94, 0.2)",
};

const endButtonStyle = {
  border: "none",
  background: "#dc2626",
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 14,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const conversationHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const clearButtonStyle = {
  border: "none",
  background: "#e2e8f0",
  color: "#0f172a",
  padding: "10px 12px",
  borderRadius: 12,
  fontWeight: 700,
};

const conversationStyle = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(241,245,249,0.95))",
  borderRadius: 28,
  padding: 14,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minHeight: 0,
};

const emptyStateStyle = {
  minHeight: 200,
  display: "grid",
  placeItems: "center",
  color: "#64748b",
  textAlign: "center",
};

const controlsStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const speakerButtonStyle = (background) => ({
  minHeight: 72,
  border: "none",
  background,
  color: "#fff",
  borderRadius: 22,
  fontWeight: 800,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const recordingStyle = {
  animation: "pulseRing 1.2s infinite",
  border: "3px solid #ef4444",
};

const modalButtonStyle = (background) => ({
  border: "none",
  borderRadius: 14,
  padding: "14px 16px",
  background,
  color: "#fff",
  fontWeight: 800,
});
