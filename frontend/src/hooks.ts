import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { api, Group, Member } from "@/src/api";
import { useAuth } from "@/src/auth";
import { userColorFor } from "@/src/theme";

export function useActiveGroup() {
  const { user } = useAuth();
  const gid = user?.active_group_id ?? null;
  const group = useQuery({ queryKey: ["group", gid], queryFn: () => api<Group>(`/groups/${gid}`), enabled: !!gid });
  return { gid, group: group.data ?? null };
}

export function useMembers() {
  const { gid } = useActiveGroup();
  const q = useQuery({
    queryKey: ["members", gid],
    queryFn: () => api<Member[]>(`/groups/${gid}/members`),
    enabled: !!gid,
  });
  const members = useMemo(() => q.data ?? [], [q.data]);
  const helpers = useMemo(() => {
    const byId: Record<string, Member> = {};
    members.forEach((m) => (byId[m.id] = m));
    return {
      byId,
      colorFor: (uid: string) => userColorFor(byId[uid]?.color_index ?? 0),
      nameFor: (uid: string) => byId[uid]?.username ?? "?",
    };
  }, [members]);
  return { ...q, members, ...helpers };
}
