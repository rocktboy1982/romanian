"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function CommunityForumClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [threads, setThreads] = useState<{title:string, posts:number}[]>([]);
  const [title, setTitle] = useState("");

  useEffect(()=>{ try{ const raw = localStorage.getItem('dev_threads'); if(raw) setThreads(JSON.parse(raw)); }catch(e){} },[]);
  useEffect(()=>{ try{ localStorage.setItem('dev_threads', JSON.stringify(threads)); }catch(e){} },[threads]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const createThread = () => {
    if (!title.trim()) return;
    setThreads((s)=>[{title: title.trim(), posts: 0}, ...s]);
    setTitle('');
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="New thread title" />
        <button className="bg-primary text-white px-3 rounded" onClick={createThread}>Create</button>
      </div>
      <div className="space-y-3">
        {threads.map((t,i)=>(
          <div key={i} className="rounded border p-3">
            <div className="font-semibold">{t.title}</div>
            <div className="text-sm text-muted-foreground">{t.posts} posts</div>
          </div>
        ))}
        {threads.length===0 && <div className="text-muted-foreground">No threads yet.</div>}
      </div>
    </div>
  );
}
