import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { sanitizePersistedNotifications } from "./notificationStorage";

export type NotificationLevel = "info" | "warning" | "success" | "error";

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  level: NotificationLevel;
  link?: string;          // path เปิดเมื่อกด
  createdAt: number;
  read: boolean;
  /**
   * เมื่อ persistent = true จะอยู่ใน localStorage ข้ามรีเฟรชจนกว่าจะ dismiss
   * (เช่น แจ้งเตือน 8:00 ของ daily check)
   */
  persistent?: boolean;
  /** จัดกลุ่มเพื่อจำกัดจำนวนที่เก็บลง localStorage แยกกัน (เช่น "petition") */
  group?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  push: (n: Omit<AppNotification, "createdAt" | "read"> & { createdAt?: number; read?: boolean }) => void;
  dismiss: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const STORAGE_KEY_PREFIX = "lis.notifications.v1";

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
};

const notificationStorageKey = (user: { employeeId?: string; email?: string; name?: string } | null | undefined) => {
  const identity = user?.employeeId?.trim() || user?.email?.trim() || user?.name?.trim() || "anonymous";
  return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(identity)}`;
};

const loadPersisted = (storageKey: string): AppNotification[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sanitizePersistedNotifications(parsed) : [];
  } catch {
    return [];
  }
};

const persist = (storageKey: string, list: AppNotification[]) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(sanitizePersistedNotifications(list)));
  } catch {
    // ignore quota errors
  }
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const storageKey = notificationStorageKey(user);
  const [state, setState] = useState(() => ({
    storageKey,
    notifications: loadPersisted(storageKey),
  }));
  const notifications = state.notifications;

  useEffect(() => {
    setState(prev => prev.storageKey === storageKey ? prev : { storageKey, notifications: loadPersisted(storageKey) });
  }, [storageKey]);

  useEffect(() => {
    if (state.storageKey !== storageKey) return;
    persist(storageKey, state.notifications);
  }, [state, storageKey]);

  const push: NotificationContextType["push"] = useCallback((n) => {
    setState(prevState => {
      const prev = prevState.storageKey === storageKey ? prevState.notifications : loadPersisted(storageKey);
      // ห้ามซ้ำตาม id — ถ้ามีอยู่แล้วให้คงของเดิม (ไม่ override read state)
      if (prev.some(p => p.id === n.id)) return { storageKey, notifications: prev };
      const next: AppNotification = {
        createdAt: n.createdAt ?? Date.now(),
        read: n.read ?? false,
        ...n,
      };
      return { storageKey, notifications: [next, ...prev] };
    });
  }, [storageKey]);

  const dismiss = useCallback((id: string) => {
    setState(prev => ({ ...prev, notifications: prev.notifications.filter(n => n.id !== id) }));
  }, []);

  const markRead = useCallback((id: string) => {
    setState(prev => ({ ...prev, notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n) }));
  }, []);

  const markAllRead = useCallback(() => {
    setState(prev => ({ ...prev, notifications: prev.notifications.map(n => ({ ...n, read: true })) }));
  }, []);

  const clearAll = useCallback(() => setState(prev => ({ ...prev, notifications: [] })), []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    push,
    dismiss,
    markRead,
    markAllRead,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
