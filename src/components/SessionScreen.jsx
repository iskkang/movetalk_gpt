import { useEffect, useRef, useState } from "react";
import SubtitleCard from "./SubtitleCard";
import Toast from "./Toast";
import Modal from "./Modal";
import { checkMicPermission, startRecording, stopRecording } from "../utils/audio";
import {
  createSessionStream,
  endSession,
  getSessionDetail,
  transcribeAndTranslate,
} from "../utils/api";
import { getCopy } from "../utils/i18n";

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
    translatedText: "",
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
  uiLang,
  participantRole,
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
  const [presence, setPresence] = useState({ host: false, guest: false });
  const conversationRef = useRef(null);
  const text = getCopy(uiLang);
  const isHost = participantRole === "host";
  const counterpartRole = isHost ? "guest" : "host";
  const inviteLink = `${window.location.origin}?session=${sessionId}&role=guest`;

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
    let active = true;

    const loadSession = async () => {
      try {
        const session = await getSessionDetail(sessionId);
        if (!active) {
          return;
        }

        setMessages(
          (session.messages || []).map((message) => ({
            ...message,
            failed: false,
          })),
        );
        setIsSessionEnded(Boolean(session.endedAt));
      } catch (error) {
        if (active) {
          showToast(error.message || text.enterSessionError);
        }
      }
    };

    loadSession();

    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    const stream = createSessionStream(sessionId, participantRole);

    stream.addEventListener("snapshot", (event) => {
      const payload = JSON.parse(event.data);
      setMessages(
        (payload.messages || []).map((message) => ({
          ...message,
          failed: false,
        })),
      );
    });

    stream.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      setMessages((prev) => {
        if (prev.some((item) => item.id === payload.id)) {
          return prev;
        }

        return [...prev, { ...payload, failed: false }];
      });
    });

    stream.addEventListener("presence", (event) => {
      const payload = JSON.parse(event.data);
      setPresence(payload);
    });

    stream.addEventListener("sessionEnded", () => {
      setIsSessionEnded(true);
    });

    stream.onerror = () => {
      stream.close();
    };

    return () => {
      stream.close();
    };
  }, [participantRole, sessionId]);

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
        error.message || text.processError,
        speakerRole,
        audioBlob,
        currentSourceLang,
        currentTargetLang,
      );
      failure.translatedText = text.failedCardText;

      setMessages((prev) => {
        const next = failedMessageId ? prev.filter((item) => item.id !== failedMessageId) : prev;
        return [...next, failure];
      });

      showToast(error.message || text.processError);
    } finally {
      setIsProcessing(false);
      setActiveSpeaker(null);
    }
  };

  const handlePressStart = async (speakerRole) => {
    if (isOffline) {
      showToast(text.internetCheck, "warning");
      return;
    }

    if (isProcessing || isSessionEnded || recorderState.instance) {
      return;
    }

    const hasPermission = await checkMicPermission();
    if (!hasPermission) {
      showToast(text.micDenied, "error");
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
      showToast(error.message || text.startRecordingError);
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
      showToast(text.shortRecording);
      return;
    }

    try {
      const audioBlob = await stopRecording(instance);
      const direction = isHost
        ? { source: sourceLang, target: targetLang }
        : { source: targetLang, target: sourceLang };

      await submitAudio({
        audioBlob,
        speakerRole: participantRole,
        currentSourceLang: direction.source,
        currentTargetLang: direction.target,
      });
    } catch (error) {
      setActiveSpeaker(null);
      showToast(error.message || text.recordingError);
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
      showToast(error.message || text.startSessionError);
    }
  };

  const handleCopyConversation = async () => {
    const lines = messages
      .filter((message) => !message.failed)
      .map((message) => {
        const speakerLabel = message.speakerRole === "me" ? text.me : text.other;
        const time = new Date(message.timestamp).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        return `[${time}] ${speakerLabel}: ${message.originalText} / ${message.translatedText}`;
      });

    await navigator.clipboard.writeText(lines.join("\n"));
    showToast(text.copied, "success");
  };

  const canRecord =
    !isOffline && !isProcessing && !isSessionEnded && !recorderState.instance;

  const liveStatus = presence[counterpartRole] ? text.participantConnected : text.participantWaiting;

  return (
    <section style={screenStyle}>
      <Toast {...toast} onHide={() => setToast((prev) => ({ ...prev, visible: false }))} />

      {isOffline && (
        <div style={offlineBannerStyle}>{text.internetCheck}</div>
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
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
              {isHost ? text.roleHost : text.roleGuest} · {liveStatus}
            </div>
          </div>
        </div>

        <button style={endButtonStyle} onClick={handleEndSession} disabled={isProcessing}>
          {text.sessionEnd}
        </button>
      </header>

      <div style={conversationHeaderStyle}>
        <div>
          <strong>{isHost ? contactName : text.liveConnected}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>{text.liveTranscript}</div>
        </div>
        {isHost ? (
          <button style={clearButtonStyle} onClick={async () => {
            await navigator.clipboard.writeText(inviteLink);
            showToast(text.copyInviteSuccess, "success");
          }}>
            {text.copyInviteLink}
          </button>
        ) : (
          <span style={presenceBadgeStyle(presence.host)}>{text.liveConnected}</span>
        )}
      </div>

      {isHost && (
        <div style={inviteCardStyle}>
          <strong style={{ display: "block", marginBottom: 8 }}>{text.inviteGuest}</strong>
          <div style={{ color: "#475569", fontSize: 14, marginBottom: 12 }}>{text.waitingGuest}</div>
          <div style={linkBoxStyle}>{inviteLink}</div>
        </div>
      )}

      <div ref={conversationRef} style={conversationStyle}>
        {messages.length === 0 ? (
          <div style={emptyStateStyle}>{text.emptySubtitles}</div>
        ) : (
          messages.map((message) => (
            <SubtitleCard
              key={message.id}
              speaker={message.speakerRole === participantRole ? "me" : "other"}
              timestamp={message.timestamp}
              originalText={message.originalText}
              translatedText={message.translatedText}
              failed={message.failed}
              readOnly={isSessionEnded}
              labels={text}
              speakerLabel={message.speakerRole === participantRole ? text.me : text.other}
              onRetry={() => handleRetry(message)}
            />
          ))
        )}
      </div>

      <div style={singleControlStyle}>
        <button
          style={{
            ...speakerButtonStyle("#2563eb"),
            ...(activeSpeaker === participantRole && recorderState.instance ? recordingStyle : {}),
          }}
          disabled={
            !canRecord &&
            !(recorderState.instance && recorderState.speakerRole === participantRole)
          }
          onMouseDown={() => handlePressStart(participantRole)}
          onMouseUp={handlePressEnd}
          onMouseLeave={() => {
            if (recorderState.speakerRole === participantRole) {
              handlePressEnd();
            }
          }}
          onTouchStart={() => handlePressStart(participantRole)}
          onTouchEnd={handlePressEnd}
        >
          {isProcessing && activeSpeaker === participantRole ? makeSpinner() : text.speakNow}
        </button>
      </div>

      {showSummaryModal && (
        <Modal title={text.sessionSummary} onClose={() => setShowSummaryModal(false)}>
          <div style={{ display: "grid", gap: 10 }}>
            <strong>{sessionTitle}</strong>
            <span>
              {text.messageCount}: {summary?.totalMessages ?? messages.filter((item) => !item.failed).length}
            </span>
            <span>{text.duration}: {summary?.duration || text.inProgress}</span>
            <button style={modalButtonStyle("#0f172a")} onClick={handleCopyConversation}>
              {text.copyConversation}
            </button>
            <button
              style={modalButtonStyle("#2563eb")}
              onClick={() => {
                setShowSummaryModal(false);
                onViewHistory();
              }}
            >
              {text.viewHistory}
            </button>
            <button style={modalButtonStyle("#16a34a")} onClick={onStartNewSession}>
              {text.startNewSession}
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

const singleControlStyle = {
  display: "grid",
};

const inviteCardStyle = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  borderRadius: 18,
  padding: 14,
};

const linkBoxStyle = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #d1fae5",
  padding: "10px 12px",
  color: "#14532d",
  fontSize: 13,
  wordBreak: "break-all",
};

const presenceBadgeStyle = (connected) => ({
  borderRadius: 999,
  background: connected ? "#dcfce7" : "#fef3c7",
  color: connected ? "#166534" : "#92400e",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 800,
});

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
