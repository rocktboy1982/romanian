"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function PostsContentTypesClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [types, setTypes] = useState<string[]>([]);

  useEffect(()=>{ try{ const raw = localStorage.getItem('dev_post_types'); if(raw) setTypes(JSON.parse(raw)); } catch(e){} }, []);
  useEffect(()=>{ try{ localStorage.setItem('dev_post_types', JSON.stringify(types)); } catch(e){} }, [types]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const add = () => setTypes((s)=>[...s, `Type ${s.length+1}`]);

  return (
    <div>
      <div className="mb-3">
        <button className="bg-primary text-white px-3 rounded" onClick={add}>Add Post Type</button>
      </div>
      <div className="space-y-2">
        {types.map((t,i)=>(<div key={i} className="rounded border p-2">{t}</div>))}
        {types.length===0 && <div className="text-muted-foreground">No content types defined.</div>}
      </div>
    </div>
  );
}
