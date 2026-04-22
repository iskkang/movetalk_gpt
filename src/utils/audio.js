let mediaRecorder = null;
let activeStream = null;

function resolveMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  if (MediaRecorder.isTypeSupported?.("audio/webm")) {
    return "audio/webm";
  }

  return "";
}

export async function checkMicPermission() {
  try {
    if (navigator.permissions?.query) {
      const permission = await navigator.permissions.query({ name: "microphone" });
      if (permission.state === "denied") {
        return false;
      }
    }

    return true;
  } catch {
    return true;
  }
}

export async function startRecording() {
  activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = resolveMimeType();
  const chunks = [];

  mediaRecorder = mimeType
    ? new MediaRecorder(activeStream, { mimeType })
    : new MediaRecorder(activeStream);

  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  mediaRecorder.__chunks = chunks;
  mediaRecorder.start();
  return mediaRecorder;
}

export function stopRecording(recorder) {
  return new Promise((resolve, reject) => {
    if (!recorder) {
      reject(new Error("Recorder instance is missing."));
      return;
    }

    recorder.addEventListener(
      "stop",
      () => {
        const blob = new Blob(recorder.__chunks || [], {
          type: recorder.mimeType || "audio/webm",
        });

        recorder.stream?.getTracks().forEach((track) => track.stop());
        activeStream = null;
        mediaRecorder = null;
        resolve(blob);
      },
      { once: true },
    );

    recorder.addEventListener(
      "error",
      () => {
        reject(new Error("녹음 중 오류가 발생했습니다."));
      },
      { once: true },
    );

    recorder.stop();
  });
}
