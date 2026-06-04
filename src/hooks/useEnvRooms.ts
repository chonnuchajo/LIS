import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ENV_ROOMS, mergeEnvRooms, type EnvRoom } from "@/lib/dailyCheckEnv";

/**
 * Environment rooms with DB config (board + thresholds) overlaid on the code
 * defaults. Falls back to pure defaults while loading or on error so the env
 * page always renders all 3 rooms.
 */
export function useEnvRooms(): { rooms: EnvRoom[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["env-room-config"],
    queryFn: api.getEnvRoomConfigs,
    staleTime: 5 * 60 * 1000,
  });
  const rooms = useMemo(() => mergeEnvRooms(ENV_ROOMS, data ?? []), [data]);
  return { rooms, isLoading };
}
