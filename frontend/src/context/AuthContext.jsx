import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import apiClient from "../api/apiClient";

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const storedUser = localStorage.getItem(
      "pharmaerp_user"
    );

    return storedUser
      ? JSON.parse(storedUser)
      : null;
  } catch {
    localStorage.removeItem(
      "pharmaerp_user"
    );

    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    readStoredUser
  );

  const [token, setToken] = useState(
    localStorage.getItem(
      "pharmaerp_token"
    )
  );

  const login = async ({
    email,
    password,
  }) => {
    const response = await apiClient.post(
      "/auth/login",
      {
        email,
        password,
      }
    );

    const responseData = response.data;

    const receivedToken =
      responseData.token ||
      responseData.data?.token;

    const receivedUser =
      responseData.user ||
      responseData.data?.user;

    if (!receivedToken) {
      throw new Error(
        "Login token was not returned by the server"
      );
    }

    localStorage.setItem(
      "pharmaerp_token",
      receivedToken
    );

    localStorage.setItem(
      "pharmaerp_user",
      JSON.stringify(receivedUser || {})
    );

    setToken(receivedToken);
    setUser(receivedUser || {});

    return {
      user: receivedUser,
      token: receivedToken,
    };
  };

  const logout = () => {
    localStorage.removeItem(
      "pharmaerp_token"
    );

    localStorage.removeItem(
      "pharmaerp_user"
    );

    setToken(null);
    setUser(null);
  };

  const contextValue = useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      isAuthenticated: Boolean(token),
    }),
    [user, token]
  );

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}