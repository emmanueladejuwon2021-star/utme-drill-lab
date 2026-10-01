import { store } from "./store.js";

export async function api(path, options = {}) {
  const token = store.getState().session.token;
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function deviceId() {
  let id = localStorage.getItem("td-device");
  if (!id) {
    id = `device-${crypto.randomUUID()}`;
    localStorage.setItem("td-device", id);
  }
  return id;
}
