"use client";
import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase-client";

type PantryItem = { id: string; name: string; qty?: string; created_at?: string };
const LS_KEY = "dev_pantry";

export default function PantryRemoteClient() {
  const { push } = useToast();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch (e) {}
  };

  const persist = (next: PantryItem[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch (e) {}
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (user) {
        const { data, error } = await supabase.from('pantry').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (!error && data) { setItems(data as PantryItem[]); setLoading(false); return; }
      }
    } catch (e) {
      // fallback
    }
    loadLocal();
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const add = async () => {
    if (!name.trim()) return;
    const temp: PantryItem = { id: `temp-${Date.now()}`, name: name.trim(), qty: qty.trim(), created_at: new Date().toISOString() };
    setItems((s) => [temp, ...s]);
    persist([temp, ...items]);
    setName(""); setQty("");
    try {
      const res = await fetch('/api/pantry', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ name: temp.name, qty: temp.qty }) });
      if (!res.ok) throw new Error('Create failed');
      const created = await res.json();
      setItems((s) => s.map((it) => it.id === temp.id ? created as PantryItem : it));
      persist(items.map((it) => it.id === temp.id ? created as PantryItem : it));
    } catch (e) {
      // keep local item
      push({ message: 'Failed to save remotely; kept locally', type: 'error' });
    }
  };

  const remove = async (id: string) => {
    const prev = items;
    setItems((s) => s.filter((it) => it.id !== id));
    persist(items.filter((it) => it.id !== id));
    try {
      const res = await fetch('/api/pantry', { method: 'DELETE', headers: await getAuthHeaders(), body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('Delete failed');
    } catch (e) {
      setItems(prev); persist(prev); push({ message: 'Failed to delete remotely', type: 'error' });
    }
  };

  return (
    <main>
      <Card>
        <CardHeader>
          <CardTitle>Pantry (remote)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex gap-2">
            <input className="rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
            <input className="w-24 rounded border px-2 py-1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
            <button className="bg-primary text-white px-3 rounded" onClick={add}>Add</button>
          </div>
          {loading ? <div>Se încarcă...</div> : (
            <ul className="list-disc pl-5 space-y-2">
              {items.map((it) => (
                <li key={it.id} className="flex justify-between items-center">
                  <span>{it.name}{it.qty ? ` · ${it.qty}` : ''}</span>
                  <button className="text-sm text-red-500" onClick={() => remove(it.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
