// contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getStorageItem, setStorageItem, removeStorageItem } from "../utils/appStorage";

interface AuthContextType {
  username: string;
  isLoggedIn: boolean;
  login: (username: string) => void;
  logout: () => void;
}

declare global {
  interface Window {
    logoutFromApi: () => void;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [username, setUsername] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const login = (username: string) => {
    setIsLoggedIn(true);
    setUsername(username);
    setStorageItem("username", username);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUsername("");
    removeStorageItem("username");
    removeStorageItem("accessToken");
    removeStorageItem("refreshToken");
  };

  useEffect(() => {
    window.logoutFromApi = logout;
    const token = getStorageItem("accessToken");
    const username = getStorageItem("username");
    if (token && username) {
      setIsLoggedIn(true);
      setUsername(username);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ username, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
