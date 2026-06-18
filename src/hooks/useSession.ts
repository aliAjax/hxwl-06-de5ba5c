import { useState, useCallback, useEffect } from "react";
import type { Role, User } from "../types";
import { defaultUsers } from "../db";

const SESSION_KEY_ROLE = "hxwl_session_role";
const SESSION_KEY_USER_ID = "hxwl_session_user_id";

function loadSession(): { role: Role; userId: string } | null {
  try {
    const role = localStorage.getItem(SESSION_KEY_ROLE) as Role | null;
    const userId = localStorage.getItem(SESSION_KEY_USER_ID);
    if (role && userId) {
      return { role, userId };
    }
  } catch {}
  return null;
}

function saveSession(role: Role, userId: string): void {
  try {
    localStorage.setItem(SESSION_KEY_ROLE, role);
    localStorage.setItem(SESSION_KEY_USER_ID, userId);
  } catch {}
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY_ROLE);
    localStorage.removeItem(SESSION_KEY_USER_ID);
  } catch {}
}

interface UseSessionReturn {
  currentRole: Role;
  currentUser: User | null;
  users: User[];
  setCurrentRole: (role: Role) => void;
  setCurrentUser: (user: User) => void;
  logout: () => void;
}

export function useSession(): UseSessionReturn {
  const [currentRole, setCurrentRole] = useState<Role>(() => {
    const session = loadSession();
    return session?.role ?? "student";
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const session = loadSession();
    if (session) {
      return (
        defaultUsers.find(u => u.id === session.userId && u.role === session.role) ??
        defaultUsers[0]
      );
    }
    return defaultUsers[0];
  });

  const [users] = useState<User[]>(defaultUsers);

  const handleRoleChange = useCallback((role: Role) => {
    setCurrentRole(role);
  }, []);

  const handleUserChange = useCallback((user: User) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    saveSession(user.role, user.id);
  }, []);

  useEffect(() => {
    if (currentUser) {
      saveSession(currentRole, currentUser.id);
    }
  }, [currentRole, currentUser]);

  const handleLogout = useCallback(() => {
    clearSession();
    setCurrentRole("student");
    setCurrentUser(defaultUsers[0]);
  }, []);

  return {
    currentRole,
    currentUser,
    users,
    setCurrentRole: handleRoleChange,
    setCurrentUser: handleUserChange,
    logout: handleLogout
  };
}
