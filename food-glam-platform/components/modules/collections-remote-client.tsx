"use client";
import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase-client";

type Collection = { id: string; title: string; items?: string[]; created_at?: string };
const LS_KEY = "dev_collections";

export default function CollectionsRemoteClient() {
  const { push } = useToast();
  const [cols, setCols] = useState<Collection[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [itemInputs, setItemInputs] = useState<Record<string, string>>({});

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCols(JSON.parse(raw));
    } catch (e) {}
  };

  const persist = (next: Collection[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch (e) {}
  };

  const fetchCols = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase.from('collections').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (!error && data) { setCols(data as Collection[]); setLoading(false); return; }
      }
    } catch (e) {
      // fallback to local
    }
    loadLocal();
    setLoading(false);
  };

  useEffect(() => { fetchCols(); }, []);

  const add = async () => {
    if (!title.trim()) return;
    const temp: Collection = { id: `temp-${Date.now()}`, title: title.trim(), items: [], created_at: new Date().toISOString() };
    setCols((s) => [temp, ...s]);
    persist([temp, ...cols]);
    setTitle("");
    try {
      const res = await fetch('/api/collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: temp.title }) });
      if (!res.ok) throw new Error('Create failed');
      const created = await res.json();
      setCols((s) => s.map((c) => c.id === temp.id ? created as Collection : c));
      persist(cols.map((c) => c.id === temp.id ? created as Collection : c));
    } catch (e) {
      push({ message: 'Failed to save remotely; kept locally', type: 'error' });
    }
  };

  const addItem = async (colId: string) => {
    const input = (itemInputs[colId] || '').trim();
    if (!input) return;
    const prev = cols;
    const next = cols.map(c => c.id === colId ? { ...c, items: [input, ...(c.items || [])] } : c);
    setCols(next);
    persist(next);
    setItemInputs((s) => ({ ...s, [colId]: '' }));
    try {
      const updatedItems = next.find(c => c.id === colId)?.items || [];
      const res = await fetch('/api/collections', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: colId, items: updatedItems }) });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setCols((s) => s.map(c => c.id === colId ? updated as Collection : c));
      persist(cols.map(c => c.id === colId ? updated as Collection : c));
    } catch (e) {
      setCols(prev); persist(prev); push({ message: 'Failed to update remotely; reverted', type: 'error' });
    }
  };

  const remove = async (id: string) => {
    const prev = cols;
    setCols((s) => s.filter((c) => c.id !== id));
    persist(cols.filter((c) => c.id !== id));
    try {
      const res = await fetch('/api/collections', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('Delete failed');
    } catch (e) {
      setCols(prev); persist(prev); push({ message: 'Failed to delete remotely', type: 'error' });
    }
  };

  const removeItem = async (colId: string, index: number) => {
    const prev = cols;
    const next = cols.map(c => c.id === colId ? { ...c, items: (c.items || []).filter((_, i) => i !== index) } : c);
    setCols(next);
    persist(next);
    try {
      const updatedItems = next.find(c => c.id === colId)?.items || [];
      const res = await fetch('/api/collections', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: colId, items: updatedItems }) });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setCols((s) => s.map(c => c.id === colId ? updated as Collection : c));
      persist(cols.map(c => c.id === colId ? updated as Collection : c));
    } catch (e) {
      setCols(prev); persist(prev); push({ message: 'Failed to update remotely; reverted', type: 'error' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collections (remote)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2">
          <input className="rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New collection title" />
          <button className="bg-primary text-white px-3 rounded" onClick={add}>Create</button>
        </div>
        {loading ? <div>Se încarcă...</div> : (
          <ul className="space-y-2">
            {cols.map((c) => (
              <li key={c.id} className="flex justify-between items-center border rounded p-2 bg-card">
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-sm text-muted-foreground">{(c.items || []).length} items</div>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-foreground/80">Open</button>
                  <button className="text-sm text-red-500" onClick={() => remove(c.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
