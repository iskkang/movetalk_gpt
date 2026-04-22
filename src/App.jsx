/*
  HOW TO RUN LOCALLY:
  1. Create .env with VITE_API_URL=http://localhost:3001
  2. Run: npm run dev
  REQUIRED ENV VARS: VITE_API_URL
*/

import { useState } from "react";
import StartScreen from "./components/StartScreen";
import SessionScreen from "./components/SessionScreen";
import HistoryScreen from "./components/HistoryScreen";
import HistoryDetailScreen from "./components/HistoryDetailScreen";

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

  const goToStart = () => {
    setSessionInfo(initialSessionInfo);
    setSelectedSessionId("");
    setCurrentScreen("start");
  };

  return (
    <div style={appShellStyle}>
      <div style={phoneFrameStyle}>
        {currentScreen === "start" && (
          <StartScreen
            uiLang={appLanguage}
            onLanguageChange={setAppLanguage}
            onStart={(nextSessionInfo) => {
              setAppLanguage(nextSessionInfo.uiLang);
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
