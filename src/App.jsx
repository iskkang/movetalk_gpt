/*
  HOW TO RUN LOCALLY:
  1. Create .env with VITE_API_URL=http://localhost:3001
  2. Run: npm run dev
  REQUIRED ENV VARS: VITE_API_URL
*/

import { useEffect, useState } from "react";
import StartScreen from "./components/StartScreen";
import SessionScreen from "./components/SessionScreen";
import HistoryScreen from "./components/HistoryScreen";
import HistoryDetailScreen from "./components/HistoryDetailScreen";
import { joinSession } from "./utils/api";

const initialSessionInfo = {
  sessionId: "",
  sessionTitle: "",
  contactName: "",
  companyName: "",
  sourceLang: "ko",
  targetLang: "ru",
  uiLang: "ko",
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("start");
  const [sessionInfo, setSessionInfo] = useState(initialSessionInfo);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [appLanguage, setAppLanguage] = useState("ko");
  const [participantRole, setParticipantRole] = useState("host");
  const [isJoining, setIsJoining] = useState(true);

  const goToStart = () => {
    setSessionInfo(initialSessionInfo);
    setSelectedSessionId("");
    setParticipantRole("host");
    window.history.replaceState({}, "", window.location.pathname);
    setCurrentScreen("start");
  };

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    const role = params.get("role");

    if (!sessionId || role !== "guest") {
      setIsJoining(false);
      return undefined;
    }

    const bootstrapGuestSession = async () => {
      try {
        const session = await joinSession(sessionId);
        if (!active) {
          return;
        }

        const uiLang = session.targetLang || "ru";
        setParticipantRole("guest");
        setAppLanguage(uiLang);
        setSessionInfo({
          sessionId: session.id,
          sessionTitle: session.sessionTitle,
          contactName: session.contactName,
          companyName: session.companyName,
          sourceLang: session.sourceLang,
          targetLang: session.targetLang,
          uiLang,
        });
        setCurrentScreen("session");
      } catch {
        if (active) {
          window.history.replaceState({}, "", window.location.pathname);
          setCurrentScreen("start");
        }
      } finally {
        if (active) {
          setIsJoining(false);
        }
      }
    };

    bootstrapGuestSession();

    return () => {
      active = false;
    };
  }, []);

  if (isJoining) {
    return (
      <div style={appShellStyle}>
        <div style={{ ...phoneFrameStyle, display: "grid", placeItems: "center", padding: 24 }}>
          연결 중...
        </div>
      </div>
    );
  }

  return (
    <div style={appShellStyle}>
      <div style={phoneFrameStyle}>
        {currentScreen === "start" && (
          <StartScreen
            uiLang={appLanguage}
            onLanguageChange={setAppLanguage}
            onStart={(nextSessionInfo) => {
              setAppLanguage(nextSessionInfo.uiLang);
              setParticipantRole("host");
              setSessionInfo(nextSessionInfo);
              setCurrentScreen("session");
            }}
            onOpenHistory={() => setCurrentScreen("history")}
          />
        )}

        {currentScreen === "session" && (
          <SessionScreen
            {...sessionInfo}
            uiLang={appLanguage}
            participantRole={participantRole}
            onViewHistory={() => setCurrentScreen("history")}
            onStartNewSession={goToStart}
          />
        )}

        {currentScreen === "history" && (
          <HistoryScreen
            uiLang={appLanguage}
            onBack={goToStart}
            onOpenDetail={(sessionId) => {
              setSelectedSessionId(sessionId);
              setCurrentScreen("historyDetail");
            }}
          />
        )}

        {currentScreen === "historyDetail" && (
          <HistoryDetailScreen
            sessionId={selectedSessionId}
            uiLang={appLanguage}
            onBack={() => setCurrentScreen("history")}
          />
        )}
      </div>
    </div>
  );
}

const appShellStyle = {
  minHeight: "100vh",
  padding: "24px 16px",
  display: "flex",
  justifyContent: "center",
  alignItems: "stretch",
};

const phoneFrameStyle = {
  width: "100%",
  maxWidth: "540px",
  minHeight: "calc(100vh - 48px)",
  background: "rgba(255, 255, 255, 0.92)",
  borderRadius: "28px",
  boxShadow: "0 30px 70px rgba(15, 23, 42, 0.14)",
  backdropFilter: "blur(12px)",
  overflow: "hidden",
  border: "1px solid rgba(148, 163, 184, 0.25)",
};
