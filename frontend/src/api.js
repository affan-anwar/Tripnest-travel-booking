const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function errorMessage(data) {
  const detail = data?.detail;
  if (Array.isArray(detail)) return detail.map((d) => String(d.msg).replace("Value error, ", "")).join(", ");
  return detail || "Something went wrong. Please try again.";
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
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
  const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Could not load the file");
  return res.blob();
}
