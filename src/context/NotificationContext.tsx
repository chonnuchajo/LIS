import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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

const STORAGE_KEY = "lis.notifications.v1";

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
};

const loadPersisted = (): AppNotification[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persist = (list: AppNotification[]) => {
  const persistent = list.filter(n => n.persistent);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistent));
  } catch {
    // ignore quota errors
  }
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadPersisted());

  useEffect(() => {
    persist(notifications);
  }, [notifications]);

  const push: NotificationContextType["push"] = useCallback((n) => {
    setNotifications(prev => {
      // ห้ามซ้ำตาม id — ถ้ามีอยู่แล้วให้คงของเดิม (ไม่ override read state)
      if (prev.some(p => p.id === n.id)) return prev;
      const next: AppNotification = {
        createdAt: n.createdAt ?? Date.now(),
        read: n.read ?? false,
        ...n,
      };
      return [next, ...prev];
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

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
