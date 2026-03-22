"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function PantryClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [items, setItems] = useState<{name:string, qty:string}[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dev_pantry");
      if (raw) setItems(JSON.parse(raw));
    } catch (e) {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("dev_pantry", JSON.stringify(items)); } catch (e) {}
  }, [items]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const add = () => {
    if (!name.trim()) return;
    setItems((s) => [...s, { name: name.trim(), qty: qty.trim() }]);
    setName("");
    setQty("");
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input className="rounded border px-2 py-1" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Item name" />
        <input className="w-24 rounded border px-2 py-1" value={qty} onChange={(e)=>setQty(e.target.value)} placeholder="Qty" />
        <button className="bg-primary text-white px-3 rounded" onClick={add}>Add</button>
      </div>
      <ul className="list-disc pl-5">
        {items.map((it, idx) => (
          <li key={idx} className="flex justify-between items-center">
            <span>{it.name} {it.qty ? `· ${it.qty}` : ''}</span>
            <button className="text-sm text-red-500" onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
