// api/apiClient.ts
import axios from "axios";

// Create an Axios instance with default configuration
const apiClient = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}`, // Base URL of our backend API
  // headers: {
  //   "Content-Type": "application/json", // Default Content-Type
  // },
});

// Function to refresh the token
const refreshToken = async () => {
  try {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}token/refresh/`,
      {
        refresh: localStorage.getItem("refreshToken"), // Assuming the refresh token is stored in localStorage
      }
    );
    const { access: newAccessToken } = response.data;
    localStorage.setItem("accessToken", newAccessToken);
    return newAccessToken;
  } catch (error) {
    console.error("Error refreshing token:", error);
    // Handle token refresh error, e.g., by logging out the user
    if (typeof window.logoutFromApi === "function") {
      window.logoutFromApi();
    }
    throw error; // Rethrow after handling to ensure the original request also fails
  }
};

// Request interceptor to include the JWT token in every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
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
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark request as retried
      try {
        const newAccessToken = await refreshToken(); // Attempt to refresh token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`; // Update the header with the new token
        return apiClient(originalRequest); // Retry the original request with the new token
      } catch (refreshError) {
        return Promise.reject(refreshError); // If refresh fails, reject the promise
      }
    }
    return Promise.reject(error); // For all other errors, reject the promise
  }
);

export default apiClient;
