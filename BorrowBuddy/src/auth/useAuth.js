import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

// Returns { user, profile, loading, error, signIn, signOut, saveProfile }.
export function useAuth() {
  return useContext(AuthContext);
}
