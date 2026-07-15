import { createContext, useContext, useState } from "react";
import client from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("fintrack_user");
    return stored ? JSON.parse(stored) : null;
  });

  const applySession = (data) => {
    localStorage.setItem("fintrack_token", data.access_token);
    localStorage.setItem("fintrack_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  // Returns either { mfaRequired: true, tempToken } or the logged-in user.
  const login = async (email, password) => {
    const { data } = await client.post("/api/auth/login", { email, password });
    if (data.mfa_required) {
      return { mfaRequired: true, tempToken: data.temp_token };
    }
    return applySession(data);
  };

  const verifyMfaLogin = async (tempToken, code) => {
    const { data } = await client.post("/api/auth/mfa/login-verify", {
      temp_token: tempToken,
      code,
    });
    return applySession(data);
  };

  const register = async (full_name, email, password) => {
    const { data } = await client.post("/api/auth/register", { full_name, email, password });
    return applySession(data);
  };

  // Returns either { mfaRequired: true, tempToken } or the logged-in user.
  const loginWithGoogle = async (credential) => {
    const { data } = await client.post("/api/auth/google", { credential });
    if (data.mfa_required) {
      return { mfaRequired: true, tempToken: data.temp_token };
    }
    return applySession(data);
  };

  const logout = () => {
    localStorage.removeItem("fintrack_token");
    localStorage.removeItem("fintrack_user");
    setUser(null);
  };

  const refreshUser = async () => {
    const { data } = await client.get("/api/auth/me");
    localStorage.setItem("fintrack_user", JSON.stringify(data));
    setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider
      value={{ user, login, verifyMfaLogin, register, loginWithGoogle, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
