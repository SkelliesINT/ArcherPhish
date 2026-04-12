// AuthContext.jsx
import React, { createContext, useContext, useState, useMemo } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Read user from localStorage on init
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Compute permissions as a simple array of strings
  const permissions = useMemo(() => {
    if (!user?.permissions) return [];
    // Optional: normalize permissions to lowercase & trim
    return user.permissions.map(p => p.toLowerCase().trim());
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, setUser, permissions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);