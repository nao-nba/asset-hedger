"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Snapshot } from "@/types/snapshot";

export function useSnapshot() {
  const [user, setUser] = useState<User | null>(null);
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/auth");
        return;
      }
      setUser(user);

      const { data } = await supabase
        .from("asset_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("snapshot_date", { ascending: false })
        .limit(24);

      if (data && data.length > 0) {
        setLatest(data[0]);
        setHistory([...data].reverse());
      }
      setLoading(false);
    });
  }, []);

  return { user, latest, history, loading };
}

export function sum(arr: { amount: number }[]) {
  return arr.reduce((acc, v) => acc + v.amount, 0);
}

export function formatJPY(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}億円`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000)}万円`;
  return `${sign}${abs.toLocaleString()}円`;
}
