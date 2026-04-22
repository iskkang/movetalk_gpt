import { useState } from "react";
import Toast from "./Toast";
import { startSession } from "../utils/api";

const languages = [
  { value: "ko", label: "한국어" },
  { value: "ru", label: "러시아어" },
];

export default function StartScreen({ onStart, onOpenHistory }) {
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sourceLang, setSourceLang] = useState("ko");
  const [targetLang, setTargetLang] = useState("ru");
  const [toast, setToast] = useState({ message: "", type: "error", visible: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message, type = "error") => {
    setToast({ message, type, visible: true });
  };

  const handleStart = async () => {
    if (!contactName.trim()) {
      showToast("상대방 이름을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await startSession(
        contactName.trim(),
        companyName.trim(),
        sourceLang,
        targetLang,
      );

      onStart({
        sessionId: session.sessionId,
        sessionTitle: session.sessionTitle,
        createdAt: session.createdAt,
        contactName: contactName.trim(),
        companyName: companyName.trim(),
        sourceLang,
        targetLang,
      });
    } catch (error) {
      showToast(error.message || "세션을 시작할 수 없습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={screenStyle}>
      <Toast {...toast} onHide={() => setToast((prev) => ({ ...prev, visible: false }))} />
      <div>
        <p style={eyebrowStyle}>Live Subtitle Interpreter</p>
        <h1 style={titleStyle}>물류 통역을 끊기지 않게 이어주는 실전형 MVP</h1>
        <p style={descriptionStyle}>
          거래처명 중심으로 세션을 시작하고, 자막형 대화를 저장하는 구조입니다.
        </p>
      </div>

      <div style={cardStyle}>
        <label style={labelStyle}>
          Contact Name
          <input
            style={inputStyle}
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="상대방 이름"
          />
        </label>

        <label style={labelStyle}>
          Company Name
          <input
            style={inputStyle}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="회사명 (선택)"
          />
        </label>

        <label style={labelStyle}>
          My Language
          <select
            style={inputStyle}
            value={sourceLang}
            onChange={(event) => setSourceLang(event.target.value)}
          >
            {languages.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Their Language
          <select
            style={inputStyle}
            value={targetLang}
            onChange={(event) => setTargetLang(event.target.value)}
          >
            {languages.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <button
          style={{ ...primaryButtonStyle, opacity: isSubmitting ? 0.75 : 1 }}
          onClick={handleStart}
          disabled={isSubmitting}
        >
          {isSubmitting ? "시작 중..." : "Start Session"}
        </button>
        <button style={secondaryButtonStyle} onClick={onOpenHistory} disabled={isSubmitting}>
          대화 기록
        </button>
      </div>
    </section>
  );
}

const screenStyle = {
  minHeight: "100%",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 24,
  justifyContent: "center",
};

const eyebrowStyle = {
  margin: 0,
  color: "#15803d",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 13,
};

const titleStyle = {
  margin: "12px 0",
  fontSize: "2rem",
  lineHeight: 1.15,
};

const descriptionStyle = {
  margin: 0,
  color: "#475569",
};

const cardStyle = {
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  borderRadius: 28,
  padding: 20,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9)",
  display: "grid",
  gap: 14,
};

const labelStyle = {
  display: "grid",
  gap: 8,
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  padding: "14px 16px",
  background: "#fff",
};

const primaryButtonStyle = {
  border: "none",
  borderRadius: 18,
  padding: "16px 18px",
  background: "#16a34a",
  color: "#fff",
  fontWeight: 800,
  fontSize: 16,
};

const secondaryButtonStyle = {
  border: "none",
  borderRadius: 18,
  padding: "14px 18px",
  background: "#e2e8f0",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 16,
};
