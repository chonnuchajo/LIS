import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type UserFavorites } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  MAX_FAVORITES,
  moveFavorite,
  normalizeFavorites,
  toggleFavorite,
  type FavoriteMoveDirection,
} from "@/lib/favorites";

// อ้างอิงตัวเดียวกันเสมอ เพื่อไม่ให้ useMemo ของผู้เรียกคำนวณใหม่ทุก render
const EMPTY_PATHS: string[] = [];

/**
 * `knownPaths` (เช่น NAV_PATHS) ใส่แล้ว toggle/move จะทำงานบนรายการที่ normalize แล้ว
 * (ตัด path เก่าที่ไม่มีใน catalog อีกต่อไปทิ้งไปในตัว) แทนรายการดิบจาก server ตรง ๆ —
 * กัน path ค้าง (ลบ/เปลี่ยนชื่อ path ใน NAV_ITEMS แล้ว) จากการกิน slot ใน cap เงียบ ๆ,
 * โผล่ปุ่มย้ายที่ดูเหมือนไม่ทำงาน (สลับกับเพื่อนบ้านที่มองไม่เห็น) และเอาออกไม่ได้เพราะไม่มี
 * context menu ให้กด — ไม่ใส่พารามิเตอร์นี้ยังทำงานแบบเดิมทุกประการ (ใช้รายการดิบ)
 */
export function useFavorites(knownPaths?: string[]) {
  const { user } = useAuth();
  const email = (user?.email ?? "").trim().toLowerCase();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["user-favorites", email], [email]);

  const { data } = useQuery({
    queryKey,
    queryFn: () => api.getUserFavorites(email),
    enabled: !!email,
    staleTime: 5 * 60 * 1000,
  });

  const favorites = data?.paths ?? EMPTY_PATHS;

  const mutation = useMutation({
    mutationFn: (paths: string[]) => api.saveUserFavorites(email, paths),
    onMutate: async (paths: string[]) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UserFavorites>(queryKey);
      queryClient.setQueryData<UserFavorites>(queryKey, { email, paths });
      return { previous };
    },
    onError: (_err, _paths, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("บันทึกรายการโปรดไม่สำเร็จ");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isFavorite = useCallback((path: string) => favorites.includes(path), [favorites]);

  // ฐานที่ toggle/move ทำงานด้วยจริง — normalize (ตัด path ค้าง + dedupe + cap) เมื่อรู้จัก
  // catalog, ไม่งั้น fallback เป็นรายการดิบเหมือนเดิม
  const effectiveFavorites = useMemo(
    () => (knownPaths ? normalizeFavorites(favorites, knownPaths) : favorites),
    [favorites, knownPaths],
  );

  const toggle = useCallback(
    (path: string) => {
      if (!email) return;
      if (!effectiveFavorites.includes(path) && effectiveFavorites.length >= MAX_FAVORITES) {
        toast.error(`รายการโปรดเก็บได้สูงสุด ${MAX_FAVORITES} รายการ`);
        return;
      }
      mutation.mutate(toggleFavorite(effectiveFavorites, path));
    },
    [email, effectiveFavorites, mutation],
  );

  const move = useCallback(
    (path: string, direction: FavoriteMoveDirection) => {
      if (!email) return;
      const next = moveFavorite(effectiveFavorites, path, direction);
      // moveFavorite คืน array ตัวเดิมเมื่อขยับไม่ได้ — ไม่ต้องยิง API
      if (next === effectiveFavorites) return;
      mutation.mutate(next);
    },
    [email, effectiveFavorites, mutation],
  );

  return { favorites, isFavorite, toggle, move };
}
