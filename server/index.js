/*
  REQUIRED ENV VARS:
  OPENAI_API_KEY — from platform.openai.com
  SUPABASE_URL — from Supabase project settings
  SUPABASE_SERVICE_KEY — from Supabase project settings (service_role key)
  PORT — optional, defaults to 3001
  FRONTEND_URL — production frontend URL for CORS
*/

require("dotenv").config();

const cors = require("cors");
const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const {
  addMessage,
  createSession,
  endSession,
  getAllSessions,
  getSession,
} = require("./sessionStore");

const app = express();
const port = Number(process.env.PORT) || 3001;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const requestBuckets = new Map();

function normalizeOrigin(value) {
  return (value || "").trim().replace(/\/$/, "");
}

function getConfiguredOrigins() {
  return (process.env.FRONTEND_URL || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function isAllowedOrigin(origin) {
  const normalizedOrigin = normalizeOrigin(origin);
  const configuredOrigins = getConfiguredOrigins();

  if (!normalizedOrigin) {
    return true;
  }

  if (
    normalizedOrigin === "http://localhost:5173" ||
    normalizedOrigin === "http://127.0.0.1:5173"
  ) {
    return true;
  }

  if (configuredOrigins.includes(normalizedOrigin)) {
    return true;
  }

  try {
    const { hostname } = new URL(normalizedOrigin);
    return hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function logLine(parts) {
  console.log(`[${new Date().toISOString()}] ${parts.join(" ")}`);
}

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(ip) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < 60_000);

  if (recent.length >= 30) {
    logLine([`IP=${ip}`, `PATH=${req.path}`, "RESULT=RATE_LIMIT"]);
    res.status(429).json({
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    });
    return;
  }

  recent.push(now);
  requestBuckets.set(ip, recent);
  next();
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(rateLimit);

app.use((req, res, next) => {
  res.on("finish", () => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const result = res.statusCode >= 400 ? "FAILED" : "SUCCESS";
    logLine([`IP=${ip}`, `PATH=${req.path}`, `RESULT=${result}`]);
  });
  next();
});

function languageCode(code) {
  return code === "ru" ? "ru" : "ko";
}

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is missing.");
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function transcribeAudio(buffer, fileName, sourceLang) {
  const response = await getOpenAI().audio.transcriptions.create({
    file: new File([buffer], fileName || "audio.webm", {
      type: "audio/webm",
    }),
    model: "whisper-1",
    language: languageCode(sourceLang),
  });

  return response.text;
}

async function translateText(text, sourceLang, targetLang) {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a professional business interpreter specializing in logistics,\nfreight forwarding, customs clearance, shipping schedules, cargo status,\npricing, payments, and trade communication between Korea and Russia.\nTranslate naturally, clearly, and accurately for business use.\nPreserve all numbers, dates, company names, port names, Incoterms,\ncurrencies, and container types exactly as given.\nReturn ONLY the translated text. No explanations, no notes.",
      },
      {
        role: "user",
        content: `Source language: ${sourceLang}\nTarget language: ${targetLang}\nText: ${text}`,
      },
    ],
  });

  return response.choices?.[0]?.message?.content?.trim() || "";
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/sessions/start", async (req, res) => {
  try {
    const { contactName, companyName, sourceLang, targetLang } = req.body;

    if (!contactName || !sourceLang || !targetLang) {
      res.status(400).json({ error: "필수 값이 누락되었습니다." });
      return;
    }

    const session = await createSession(contactName, companyName, sourceLang, targetLang);

    res.json({
      sessionId: session.id,
      sessionTitle: session.sessionTitle,
      createdAt: session.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: "세션을 시작할 수 없습니다. 다시 시도해주세요." });
  }
});

app.post("/api/transcribe-and-translate", (req, res, next) => {
  upload.single("audio")(req, res, (error) => {
    if (error && error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        error: "파일이 너무 큽니다. 10MB 이하만 허용됩니다.",
      });
      return;
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
});

app.post("/api/transcribe-and-translate", async (req, res) => {
  const { sourceLang, targetLang, speakerRole, sessionId } = req.body;
  const logPrefix = `sourceLang=${sourceLang} speakerRole=${speakerRole}`;

  try {
    if (!req.file || !sessionId || !speakerRole) {
      res.status(400).json({ error: "필수 요청 값이 누락되었습니다." });
      return;
    }

    const originalText = await transcribeAudio(req.file.buffer, req.file.originalname, sourceLang);
    const translatedText = await translateText(originalText, sourceLang, targetLang);
    const timestamp = new Date().toISOString();

    const message = await addMessage(sessionId, {
      speakerRole,
      originalText,
      translatedText,
      timestamp,
    });

    logLine([logPrefix, "=>", "SUCCESS"]);
    res.json({
      id: message.id,
      originalText,
      translatedText,
      speakerRole,
      sourceLang,
      targetLang,
      timestamp,
    });
  } catch (error) {
    logLine([logPrefix, "=>", "FAILED"]);
    res.status(500).json({
      error: "처리 중 오류가 발생했습니다. 다시 시도해주세요.",
    });
  }
});

app.get("/api/sessions", async (req, res) => {
  try {
    const sessions = await getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: "기록을 불러오지 못했습니다. 다시 시도해주세요." });
  }
});

app.get("/api/sessions/:sessionId", async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: "상세 기록을 불러오지 못했습니다." });
  }
});

app.post("/api/sessions/:sessionId/end", async (req, res) => {
  try {
    const result = await endSession(req.params.sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "세션 종료에 실패했습니다." });
  }
});

app.listen(port, () => {
  logLine([`API listening on ${port}`]);
});
