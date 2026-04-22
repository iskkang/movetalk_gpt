import { useState } from "react";
import Toast from "./Toast";
import { startSession } from "../utils/api";
import { getCopy, getLanguageOptions } from "../utils/i18n";

export default function StartScreen({ uiLang, onLanguageChange, onStart, onOpenHistory }) {
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sourceLang, setSourceLang] = useState("ko");
  const [targetLang, setTargetLang] = useState("ru");
  const [toast, setToast] = useState({ message: "", type: "error", visible: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const text = getCopy(uiLang);
  const languages = getLanguageOptions(uiLang);

  const showToast = (message, type = "error") => {
    setToast({ message, type, visible: true });
  };

  const handleStart = async () => {
    if (!contactName.trim()) {
      showToast(text.contactRequired);
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
        uiLang,
      });
    } catch (error) {
      showToast(error.message || text.startSessionError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={screenStyle}>
      <Toast {...toast} onHide={() => setToast((prev) => ({ ...prev, visible: false }))} />
      <div>
        <p style={eyebrowStyle}>{text.appName}</p>
        <h1 style={titleStyle}>{text.startTitle}</h1>
        <p style={descriptionStyle}>{text.startDescription}</p>
      </div>

      <div style={cardStyle}>
        <label style={labelStyle}>
          {text.contactName}
          <input
            style={inputStyle}
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder={text.contactPlaceholder}
          />
        </label>

        <label style={labelStyle}>
          {text.companyName}
          <input
            style={inputStyle}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder={text.companyPlaceholder}
          />
        </label>

        <label style={labelStyle}>
          {text.myLanguage}
          <select
            style={inputStyle}
            value={sourceLang}
            onChange={(event) => {
              const nextLang = event.target.value;
              setSourceLang(nextLang);
              onLanguageChange(nextLang);
            }}
          >
            {languages.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          {text.theirLanguage}
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
          {isSubmitting ? text.starting : text.startSession}
        </button>
        <button style={secondaryButtonStyle} onClick={onOpenHistory} disabled={isSubmitting}>
          {text.history}
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
