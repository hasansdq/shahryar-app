// ═══ اعضای انجمن — فهرست اعضای فعال با نقش و آمار فعالیت ═══
"use client";

import { useEffect, useState } from "react";
import { Crown, MessageSquare, UserCheck, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { get } from "@/lib/client/api";
import { faNum, faRelative } from "@/lib/client/persian";
import { useAppStore } from "@/lib/client/store";
import type { ForumDetailData, ForumMemberDTO } from "@/lib/modules/forums/types";
import { PersonAvatar } from "../social/social-ui";

export default function ForumMembers({ forum }: { forum: ForumDetailData }) {
  const openUserProfile = useAppStore((s) => s.openUserProfile);
  const [members, setMembers] = useState<ForumMemberDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await get<{ members: ForumMemberDTO[] }>(`/api/forums/${forum.id}/members`);
      if (!active) return;
      if (res.success && res.data) setMembers(res.data.members);
      else if (res.error) toast({ title: "خطا", description: res.error, variant: "destructive" });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [forum.id]);

  if (loading) {
    return (
      <div className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  const list = members || [];

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-black">اعضای انجمن</h3>
          <p className="text-[11px] text-muted-foreground">{faNum(list.length)} عضو فعال</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          هنوز عضوی در این انجمن نیست.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => (
            <button
              key={m.id}
              onClick={() => openUserProfile(m.userId)}
              title={`پروفایل ${m.name}`}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-right transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.98]"
            >
              {m.avatarUrl ? (
                <img src={m.avatarUrl} alt={m.name} className="size-12 shrink-0 rounded-2xl object-cover" />
              ) : (
                <PersonAvatar name={m.name} color={m.avatarColor} size={48} className="shadow-none" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-black" title={m.name}>{m.name}</p>
                  {m.role === "CHAIR" ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                      <Crown className="size-2.5" />
                      رئیس
                    </span>
                  ) : null}
                </div>
                {m.headline ? (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={m.headline}>{m.headline}</p>
                ) : null}
                <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground/80">
                  <span className="inline-flex items-center gap-1 tnum">
                    <MessageSquare className="size-3" />
                    {faNum(m.messageCount)} پیام
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="size-3" />
                    {faRelative(m.joinedAt)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
