"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function ShoppingListsClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [items, setItems] = useState<string[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dev_shopping_list");
      if (raw) setItems(JSON.parse(raw));
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("dev_shopping_list", JSON.stringify(items));
    } catch (e) {}
  }, [items]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const add = () => {
    if (!text.trim()) return;
    setItems((s) => [...s, text.trim()]);
    setText("");
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add item" />
        <button className="bg-primary text-white px-3 rounded" onClick={add}>Add</button>
      </div>
      <ul className="list-disc pl-5">
        {items.map((it, idx) => (
          <li key={idx} className="flex justify-between items-center">
            <span>{it}</span>
            <button className="text-sm text-red-500" onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
