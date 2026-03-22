"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function CollectionsClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [collections, setCollections] = useState<{name:string, items:string[]}[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dev_collections");
      if (raw) setCollections(JSON.parse(raw));
    } catch (e) {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("dev_collections", JSON.stringify(collections)); } catch (e) {}
  }, [collections]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const addCollection = () => {
    if (!name.trim()) return;
    setCollections((s) => [...s, { name: name.trim(), items: [] }]);
    setName("");
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" />
        <button className="bg-primary text-white px-3 rounded" onClick={addCollection}>Create</button>
      </div>
      <div className="space-y-3">
        {collections.map((c, i) => (
          <div key={i} className="rounded border p-3">
            <div className="font-semibold">{c.name}</div>
            <div className="text-sm text-muted-foreground">{c.items.length} items</div>
          </div>
        ))}
        {collections.length === 0 && <div className="text-muted-foreground">No collections yet.</div>}
      </div>
    </div>
  );
}
