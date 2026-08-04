import axios from "axios";

const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:5000/api`,

  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },

  timeout: 75000,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(
      "pharmaerp_token"
    );

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(
        "pharmaerp_token"
      );

      localStorage.removeItem(
        "pharmaerp_user"
      );
    }

    return Promise.reject(error);
  }
);

export default apiClient;