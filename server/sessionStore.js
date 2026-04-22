/*
  SUPABASE SETUP:
  Run this SQL in your Supabase SQL editor before starting the server.

  create table sessions (
    id text primary key,
    session_title text,
    contact_name text,
    company_name text,
    source_lang text,
    target_lang text,
    created_at timestamptz default now(),
    ended_at timestamptz,
    duration text,
    total_messages integer default 0
  );

  create table messages (
    id text primary key,
    session_id text references sessions(id),
    speaker_role text,
    original_text text,
    translated_text text,
    timestamp timestamptz default now()
  );
*/

const { randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function formatDatePart(date) {
  return date.toISOString().slice(0, 10);
}

function buildSessionTitle(contactName, sourceLang, targetLang, date = new Date()) {
  return `${formatDatePart(date)} | ${contactName} | ${sourceLang.toUpperCase()}→${targetLang.toUpperCase()}`;
}

function formatDuration(createdAt, endedAt) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((new Date(endedAt).getTime() - new Date(createdAt).getTime()) / 1000),
  );
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function mapSession(row) {
  return {
    id: row.id,
    sessionTitle: row.session_title,
    contactName: row.contact_name,
    companyName: row.company_name || "",
    sourceLang: row.source_lang,
    targetLang: row.target_lang,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    duration: row.duration,
    totalMessages: row.total_messages || 0,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    speakerRole: row.speaker_role,
    originalText: row.original_text,
    translatedText: row.translated_text,
    timestamp: row.timestamp,
  };
}

async function createSession(contactName, companyName, sourceLang, targetLang) {
  const supabase = getSupabase();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const sessionTitle = buildSessionTitle(contactName, sourceLang, targetLang, new Date(createdAt));

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      id,
      session_title: sessionTitle,
      contact_name: contactName,
      company_name: companyName || null,
      source_lang: sourceLang,
      target_lang: targetLang,
      created_at: createdAt,
      total_messages: 0,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapSession(data);
}

async function addMessage(sessionId, messageData) {
  const supabase = getSupabase();
  const messageId = randomUUID();
  const timestamp = messageData.timestamp || new Date().toISOString();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      id: messageId,
      session_id: sessionId,
      speaker_role: messageData.speakerRole,
      original_text: messageData.originalText,
      translated_text: messageData.translatedText,
      timestamp,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  const { data: sessionRow, error: sessionReadError } = await supabase
    .from("sessions")
    .select("total_messages")
    .eq("id", sessionId)
    .single();

  if (sessionReadError) {
    throw sessionReadError;
  }

  const { error: updateError } = await supabase
    .from("sessions")
    .update({ total_messages: (sessionRow?.total_messages || 0) + 1 })
    .eq("id", sessionId);

  if (updateError) {
    throw updateError;
  }

  return mapMessage(data);
}

async function getSession(sessionId) {
  const supabase = getSupabase();
  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError) {
    throw sessionError;
  }

  const { data: messageRows, error: messageError } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: true });

  if (messageError) {
    throw messageError;
  }

  return {
    ...mapSession(sessionRow),
    messages: (messageRows || []).map(mapMessage),
  };
}

async function getAllSessions() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapSession);
}

async function endSession(sessionId) {
  const supabase = getSupabase();
  const session = await getSession(sessionId);
  const endedAt = new Date().toISOString();
  const duration = formatDuration(session.createdAt, endedAt);

  const { error } = await supabase
    .from("sessions")
    .update({
      ended_at: endedAt,
      duration,
      total_messages: session.messages.length,
    })
    .eq("id", sessionId);

  if (error) {
    throw error;
  }

  return {
    totalMessages: session.messages.length,
    duration,
    sessionId,
  };
}

module.exports = {
  createSession,
  addMessage,
  getSession,
  getAllSessions,
  endSession,
};
