"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function VotesRankingsClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [items, setItems] = useState<{name:string, score:number}[]>([]);
  const [name, setName] = useState("");

  useEffect(()=>{ try{ const raw = localStorage.getItem('dev_rankings'); if(raw) setItems(JSON.parse(raw)); }catch(e){} },[]);
  useEffect(()=>{ try{ localStorage.setItem('dev_rankings', JSON.stringify(items)); }catch(e){} },[items]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const add = () => { if(!name.trim()) return; setItems((s)=>[...s, {name:name.trim(), score:0}]); setName(''); };
  const vote = (idx:number, delta:number) => setItems((s)=>s.map((it,i)=> i===idx ? {...it, score: it.score+delta} : it));

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" value={name} onChange={(e)=>setName(e.target.value)} placeholder="New item" />
        <button className="bg-primary text-white px-3 rounded" onClick={add}>Add</button>
      </div>
      <div className="space-y-2">
        {items.sort((a,b)=>b.score-a.score).map((it,i)=>(
          <div key={i} className="rounded border p-2 flex justify-between items-center">
            <div>
              <div className="font-semibold">{it.name}</div>
              <div className="text-sm text-muted-foreground">Score: {it.score}</div>
            </div>
            <div className="flex gap-2">
              <button className="px-2 py-1 rounded bg-green-500 text-white" onClick={()=>vote(i,1)}>▲</button>
              <button className="px-2 py-1 rounded bg-red-500 text-white" onClick={()=>vote(i,-1)}>▼</button>
            </div>
          </div>
        ))}
        {items.length===0 && <div className="text-muted-foreground">No items yet.</div>}
      </div>
    </div>
  );
}
