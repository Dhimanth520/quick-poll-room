import axios from "axios";

function resolveBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  return "";
}


export const api = axios.create({
  baseURL: resolveBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

function readError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail) && detail[0]?.msg) {
    return detail[0].msg;
  }
  if (error?.message) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export async function createPoll(question, options, expiresInMinutes = null) {
  try {
    const payload = { question, options };
    if (expiresInMinutes) {
      payload.expires_in_minutes = Number(expiresInMinutes);
    }
    const { data } = await api.post("/api/polls", payload);
    return data;
  } catch (error) {
    throw new Error(readError(error));
  }
}

export function getPollStreamUrl(pollId) {
  const base = resolveBaseUrl();
  return `${base}/api/polls/${encodeURIComponent(pollId)}/stream`;
}

export async function getPoll(pollId) {
  try {
    const { data } = await api.get(`/api/polls/${encodeURIComponent(pollId)}`);
    return data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new Error("Poll not found");
    }
    throw new Error(readError(error));
  }
}

export async function voteOnPoll(pollId, optionId) {
  try {
    const { data } = await api.post(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
      option_id: optionId,
    });
    return data;
  } catch (error) {
    if (error?.response?.status === 404) {
      throw new Error("Poll or option not found");
    }
    throw new Error(readError(error));
  }
}

