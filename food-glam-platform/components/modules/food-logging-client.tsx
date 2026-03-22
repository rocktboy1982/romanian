"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function FoodLoggingClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [logs, setLogs] = useState<{time:string, item:string}[]>([]);
  const [item, setItem] = useState("");

  useEffect(()=>{ try{ const raw = localStorage.getItem('dev_logs'); if(raw) setLogs(JSON.parse(raw)); }catch(e){} },[]);
  useEffect(()=>{ try{ localStorage.setItem('dev_logs', JSON.stringify(logs)); }catch(e){} },[logs]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const add = () => {
    if (!item.trim()) return;
    setLogs((s)=>[{time: new Date().toLocaleTimeString(), item: item.trim()}, ...s]);
    setItem('');
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" value={item} onChange={(e)=>setItem(e.target.value)} placeholder="Food item" />
        <button className="bg-primary text-white px-3 rounded" onClick={add}>Log</button>
      </div>
      <ul className="list-disc pl-5">
        {logs.map((l,i)=>(<li key={i}>{l.time} — {l.item}</li>))}
        {logs.length===0 && <div className="text-muted-foreground">No logs yet.</div>}
      </ul>
    </div>
  );
}
