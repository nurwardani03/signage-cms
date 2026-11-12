
import { io } from "socket.io-client";

export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export const getAuthToken = () => {
  return (
    localStorage.getItem("signage_token") ||
    sessionStorage.getItem("signage_token")
  );
};

export const apiFetch = async (url, options = {}) => {
  const token = getAuthToken();

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new Error("Session expired or authentication required. Please sign in again.");
  }

  return response;
};

export const createAdminSocket = (options = {}) => {
  const token = getAuthToken();

  return io(API_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    ...options,
    auth: {
      ...options.auth,
      token,
    },
  });
};
