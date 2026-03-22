"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function NutritionEngineClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [calculations, setCalculations] = useState<{label:string, value:string}[]>([]);

  useEffect(()=>{ try{ const raw = localStorage.getItem('dev_nutrition'); if(raw) setCalculations(JSON.parse(raw)); }catch(e){} },[]);
  useEffect(()=>{ try{ localStorage.setItem('dev_nutrition', JSON.stringify(calculations)); }catch(e){} },[calculations]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const runCalc = () => {
    const next = { label: `Calc ${calculations.length+1}`, value: `${Math.round(Math.random()*1000)} kcal` };
    setCalculations((s)=>[next, ...s]);
  };

  return (
    <div>
      <div className="mb-3">
        <button className="bg-primary text-white px-3 py-1 rounded" onClick={runCalc}>Run Nutrition Calculation</button>
      </div>
      <ul className="list-disc pl-5">
        {calculations.map((c,i)=>(<li key={i}><strong>{c.label}:</strong> {c.value}</li>))}
        {calculations.length===0 && <div className="text-muted-foreground">No calculations yet.</div>}
      </ul>
    </div>
  );
}
