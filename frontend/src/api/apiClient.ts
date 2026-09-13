// api/apiClient.ts
import axios from "axios";
import { getStorageItem, setStorageItem } from "../utils/appStorage";

// Create an Axios instance with default configuration
const apiClient = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}`, // Base URL of our backend API
  // headers: {
  //   "Content-Type": "application/json", // Default Content-Type
  // },
});

let refreshInFlight: Promise<string> | null = null;

const persistRefreshedSession = (access: string, refresh?: string) => {
  setStorageItem("accessToken", access);
  if (refresh) {
    setStorageItem("refreshToken", refresh);
  }
};

const requestNewAccessToken = async () => {
  const refresh = getStorageItem("refreshToken");
  if (!refresh) {
    throw new Error("No refresh token");
  }

  const response = await axios.post(
    `${process.env.REACT_APP_API_URL}token/refresh/`,
    { refresh }
  );
  const { access: newAccessToken, refresh: newRefreshToken } = response.data;
  persistRefreshedSession(newAccessToken, newRefreshToken);
  return newAccessToken as string;
};

// Coalesce concurrent 401s onto one refresh so a rotated token is not
// reused (and blacklisted) by a second in-flight request.
const refreshToken = async () => {
  if (!refreshInFlight) {
    refreshInFlight = requestNewAccessToken()
      .catch((error) => {
        console.error("Error refreshing token:", error);
        if (typeof window.logoutFromApi === "function") {
          window.logoutFromApi();
        }
        throw error;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

// Request interceptor to include the JWT token in every request
apiClient.interceptors.request.use(
  (config) => {
    const token = getStorageItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh logic
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Check if the response is 401 (Unauthorized) and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark request as retried
      try {
        const newAccessToken = await refreshToken(); // Attempt to refresh token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`; // Update the header with the new token
        return apiClient(originalRequest); // Retry the original request with the new token
      } catch (refreshError) {
        // Refresh failed and the user has been logged out (tokens cleared).
        // A stale token in storage must not break public read endpoints,
        // so retry once anonymously; protected endpoints will still 401.
        delete originalRequest.headers.Authorization;
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error); // For all other errors, reject the promise
  }
);

export default apiClient;
