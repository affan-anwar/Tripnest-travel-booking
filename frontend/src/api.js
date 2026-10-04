const RAW = import.meta.env.VITE_API_URL || "";
// Use the configured API address only if it is a real http(s) URL.
const BASE = /^https?:\/\//i.test(RAW) ? RAW.replace(/\/+$/, "") : "http://localhost:8000/api";

function errorMessage(data) {
  const detail = data?.detail;
  if (Array.isArray(detail)) return detail.map((d) => String(d.msg).replace("Value error, ", "")).join(", ");
  return detail || "Something went wrong. Please try again.";
}

async function request(path, options) {
  try {
    return await fetch(`${BASE}${path}`, options);
  } catch {
    throw new Error("Cannot reach the server right now. Please try again in a moment.");
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await request(path, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(data));
  return data;
}

export async function apiBlob(path) {
  const token = localStorage.getItem("token");
  const res = await request(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Could not load the file");
  return res.blob();
}