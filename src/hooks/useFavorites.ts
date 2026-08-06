import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type UserFavorites } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  MAX_FAVORITES,
  moveFavorite,
  toggleFavorite,
  type FavoriteMoveDirection,
} from "@/lib/favorites";

// อ้างอิงตัวเดียวกันเสมอ เพื่อไม่ให้ useMemo ของผู้เรียกคำนวณใหม่ทุก render
const EMPTY_PATHS: string[] = [];

export function useFavorites() {
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
      // ค่าใน cache หลัง optimistic update คือค่าจริงที่เพิ่งบันทึกสำเร็จแล้ว —
      // แค่ mark stale ไว้ ไม่ต้อง refetch ทันที กัน response ของ GET (อาจ eventual-consistent ช้ากว่า)
      // มาทับค่าที่เพิ่งเซฟถูกต้องแล้ว
      queryClient.invalidateQueries({ queryKey, refetchType: "none" });
    },
  });

  const isFavorite = useCallback((path: string) => favorites.includes(path), [favorites]);

  const toggle = useCallback(
    (path: string) => {
      if (!email) return;
      if (!favorites.includes(path) && favorites.length >= MAX_FAVORITES) {
        toast.error(`รายการโปรดเก็บได้สูงสุด ${MAX_FAVORITES} รายการ`);
        return;
      }
      mutation.mutate(toggleFavorite(favorites, path));
    },
    [email, favorites, mutation],
  );

  const move = useCallback(
    (path: string, direction: FavoriteMoveDirection) => {
      if (!email) return;
      const next = moveFavorite(favorites, path, direction);
      // moveFavorite คืน array ตัวเดิมเมื่อขยับไม่ได้ — ไม่ต้องยิง API
      if (next === favorites) return;
      mutation.mutate(next);
    },
    [email, favorites, mutation],
  );

  return { favorites, isFavorite, toggle, move };
}
