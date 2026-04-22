const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);

  if (!response.ok) {
    let message = "요청 처리에 실패했습니다.";

    try {
      const errorBody = await response.json();
      message = errorBody.error || message;
    } catch {
      // Keep fallback error message.
    }

    throw new Error(message);
  }

  return response.json();
}

export function startSession(contactName, companyName, sourceLang, targetLang) {
  return request("/api/sessions/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contactName, companyName, sourceLang, targetLang }),
  });
}

export async function transcribeAndTranslate(
  audioBlob,
  sourceLang,
  targetLang,
  speakerRole,
  sessionId,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);
  const formData = new FormData();

  formData.append("audio", audioBlob);
  formData.append("sourceLang", sourceLang);
  formData.append("targetLang", targetLang);
  formData.append("speakerRole", speakerRole);
  formData.append("sessionId", sessionId);

  try {
    return await request("/api/transcribe-and-translate", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("응답 시간이 초과되었습니다. 다시 시도해주세요.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getSessions() {
  return request("/api/sessions");
}

export function getSessionDetail(sessionId) {
  return request(`/api/sessions/${sessionId}`);
}

export function endSession(sessionId) {
  return request(`/api/sessions/${sessionId}/end`, {
    method: "POST",
  });
}
