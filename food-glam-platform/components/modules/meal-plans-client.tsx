"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function MealPlansClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [plans, setPlans] = useState<{name:string, days:number}[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    try { const raw = localStorage.getItem('dev_meal_plans'); if (raw) setPlans(JSON.parse(raw)); } catch(e){}
  }, []);
  useEffect(() => { try { localStorage.setItem('dev_meal_plans', JSON.stringify(plans)); } catch(e){} }, [plans]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const add = () => {
    if (!name.trim()) return;
    setPlans((s)=>[...s, { name: name.trim(), days: 7 }]);
    setName("");
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" value={name} onChange={(e)=>setName(e.target.value)} placeholder="New plan name" />
        <button className="bg-primary text-white px-3 rounded" onClick={add}>Create</button>
      </div>
      <div className="space-y-2">
        {plans.map((p, i)=>(
          <div key={i} className="rounded border p-3 flex justify-between">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-muted-foreground">{p.days}-day plan</div>
            </div>
            <button className="text-sm text-red-500" onClick={()=>setPlans((s)=>s.filter((_,j)=>j!==i))}>Delete</button>
          </div>
        ))}
        {plans.length===0 && <div className="text-muted-foreground">No meal plans created yet.</div>}
      </div>
    </div>
  );
}
