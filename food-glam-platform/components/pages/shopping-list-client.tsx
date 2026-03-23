"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase-client";

export default function ShoppingListClient() {
  const { push } = useToast();
  // Placeholder UI: merge, export, print
  return (
    <div className="space-y-4 max-w-2xl">
       <h2 className="text-lg font-semibold">Liste de cumpărături</h2>
      <div className="flex gap-2">
        <Button onClick={async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
            const res = await fetch('/api/shopping-lists/merge', { method: 'POST', headers });
             if (!res.ok) throw new Error('Combinarea a eșuat');
             push({ message: 'Liste combinate (placeholder)', type: 'success' });
           } catch (e) {
             push({ message: 'Combinarea a eșuat', type: 'error' });
          }
         }}>Combină listele</Button>
        <Button onClick={() => {
          // Export via simple CSV download placeholder
          const csv = 'Item,Qty\nTomatoes,2\nEggs,12';
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'shopping-list.csv'; a.click(); URL.revokeObjectURL(url);
         }}>Exportă CSV</Button>
         <Button onClick={() => window.print()}>Printează</Button>
      </div>
       <div className="text-sm text-muted-foreground">Aceasta este o versiune preliminară; combinarea pe server și partajarea vor fi implementate în curând.</div>
    </div>
  );
}
