"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function MicronutrientsClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [items, setItems] = useState<{nutrient:string, amount:string}[]>([]);

  useEffect(()=>{ try{ const raw = localStorage.getItem('dev_micro'); if(raw) setItems(JSON.parse(raw)); }catch(e){} },[]);
  useEffect(()=>{ try{ localStorage.setItem('dev_micro', JSON.stringify(items)); }catch(e){} },[items]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const addSample = () => setItems((s)=>[{nutrient:`Vit ${s.length+1}`, amount:`${Math.round(Math.random()*100)} mg`}, ...s]);

  return (
    <div>
      <div className="mb-3">
        <button className="bg-primary text-white px-3 py-1 rounded" onClick={addSample}>Add Sample Micronutrient</button>
      </div>
      <ul className="list-disc pl-5">
        {items.map((it,i)=>(<li key={i}>{it.nutrient}: {it.amount}</li>))}
        {items.length===0 && <div className="text-muted-foreground">No micronutrient data yet.</div>}
      </ul>
    </div>
  );
}
