"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function RecipesFormatPrintClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [formats, setFormats] = useState<string[]>([]);

  useEffect(()=>{ try { const raw = localStorage.getItem('dev_formats'); if(raw) setFormats(JSON.parse(raw)); } catch(e){} }, []);
  useEffect(()=>{ try{ localStorage.setItem('dev_formats', JSON.stringify(formats)); } catch(e){} }, [formats]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const add = () => setFormats((s)=>[...s, `Format ${s.length+1}`]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button className="bg-primary text-white px-3 rounded" onClick={add}>Add Print Format</button>
      </div>
      <ul className="list-disc pl-5">
        {formats.map((f,i)=>(<li key={i}>{f} — <span className="text-sm text-muted-foreground">preview</span></li>))}
        {formats.length===0 && <div className="text-muted-foreground">No print formats yet.</div>}
      </ul>
    </div>
  );
}
