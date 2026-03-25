"use client";
import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase-client";


type MealPlan = {
  id: string;
  title: string;
  dateRange: string;
  recipeCount: number;
  createdDate: string;
};

const LS_KEY = "dev_meal_plans";

export default function MealPlansRemoteClient() {
  const { push } = useToast();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

const loadFromLocal = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const transformed: MealPlan[] = parsed.map((p: any) => ({
        id: p.id,
        title: p.title,
        dateRange: p.dateRange || "2026-02-21 to 2026-03-01",
        recipeCount: p.recipeCount || 5,
        createdDate: p.createdDate || new Date().toISOString()
      }));
      setPlans(transformed);
    }
  } catch (e) {
    // ignore
  }
};

const persistLocal = (next: MealPlan[]) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch (e) {
    // ignore
  }
};

const fetchPlans = async () => {
  setLoading(true);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (user) {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!error && data) {
        const transformedPlans: MealPlan[] = data.map((row) => ({
          id: row.id,
          title: row.title,
          dateRange: "2026-02-21 to 2026-03-01",
          recipeCount: 5,
          createdDate: row.created_at || new Date().toISOString()
        }));
        setPlans(transformedPlans);
        setLoading(false);
        return;
      }
    }
  } catch (e) {
    // fall back to local
  }
  loadFromLocal();
  setLoading(false);
};

useEffect(() => {
  fetchPlans();
}, []);

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Primary: read from our persisted session
  try {
    const backup = localStorage.getItem('marechef-session')
    if (backup) {
      const parsed = JSON.parse(backup)
      if (parsed?.access_token) {
        headers['Authorization'] = `Bearer ${parsed.access_token}`
        return headers
      }
    }
  } catch {}
  // Fallback: try Supabase client
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
};

const createPlan = async (title: string) => {
  if (!title) return;
  // optimistic UI: add temp plan locally first
  const temp: MealPlan = { id: `temp-${Date.now()}`, title, dateRange: "2026-02-21 to 2026-03-01", recipeCount: 5, createdDate: new Date().toISOString() };
  setPlans((p) => [temp, ...p]);
  persistLocal([temp, ...plans]);

  try {
    const res = await fetch('/api/meal-plans', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ title }) });
    if (!res.ok) throw new Error('Create failed')
    const created = await res.json()
    setPlans((p) => p.map((pl) => (pl.id === temp.id ? (created as MealPlan) : pl)));
    persistLocal(plans.map((pl) => (pl.id === temp.id ? (created as MealPlan) : pl)));
  } catch (e) {
    // rollback on error
    setPlans((p) => p.filter((pl) => pl.id !== temp.id));
    persistLocal(plans);
    push({ message: 'Failed to create meal plan. Saved locally instead.', type: 'error' });
  }
};

const deletePlan = async (id: string) => {
  const prev = plans;
  // optimistic remove
  setPlans((p) => p.filter((pl) => pl.id !== id));
  persistLocal(plans.filter((pl) => pl.id !== id));
  try {
    const res = await fetch('/api/meal-plans', { method: 'DELETE', headers: await getAuthHeaders(), body: JSON.stringify({ id }) });
    if (!res.ok) throw new Error('Delete failed')
  } catch (e) {
    // rollback
    setPlans(prev);
    persistLocal(prev);
    push({ message: 'Failed to delete meal plan', type: 'error' });
  }
};

const updatePlan = async (id: string, title: string, meals: string[]) => {
  const prev = plans;
  // optimistic update
  setPlans((p) => p.map((pl) => (pl.id === id ? { ...pl, title } : pl)));
  persistLocal(plans.map((pl) => (pl.id === id ? { ...pl, title } : pl)));
  try {
    const res = await fetch('/api/meal-plans', { method: 'PUT', headers: await getAuthHeaders(), body: JSON.stringify({ id, title, meals }) });
    if (!res.ok) throw new Error('Update failed')
    const updated = await res.json()
    setPlans((p) => p.map((pl) => (pl.id === id ? (updated as MealPlan) : pl)));
    persistLocal(plans.map((pl) => (pl.id === id ? (updated as MealPlan) : pl)));
  } catch (e) {
    // rollback
    setPlans(prev);
    persistLocal(prev);
    push({ message: 'Failed to update meal plan', type: 'error' });
  }
};

const handleCreatePlan = () => {
  if (!newTitle) return;
  createPlan(newTitle);
  setNewTitle('');
  setIsDialogOpen(false);
};

const handleEditPlan = (id: string) => {
  setEditingId(id);
  setEditingTitle(plans.find((plan) => plan.id === id)?.title || '');
  setIsExpanded(false);
};

const handleDeletePlan = (id: string) => {
  setPendingDeleteId(id);
  push({ message: 'Click Delete again to confirm', type: 'info' });
  setTimeout(() => { if (pendingDeleteId === id) setPendingDeleteId(null); }, 4000);
  setIsExpanded(false);
};

const handleConfirmDelete = (id: string) => {
  setPendingDeleteId(null);
  deletePlan(id);
  setIsExpanded(false);
};

const handlePlanClick = (plan: MealPlan) => {
  if (selectedPlan?.id === plan.id) {
    setSelectedPlan(null);
    setIsExpanded(false);
  } else {
    setSelectedPlan(plan);
    setIsExpanded(true);
  }
};

const handleGenerateShoppingList = () => {
  // Placeholder action
  push({ message: 'Shopping list generated!', type: 'success' });
  setIsExpanded(false);
};

return (
  <main>
    <Card>
      <CardHeader>
        <CardTitle>Meal Plans (remote)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Button onClick={() => setIsDialogOpen(true)}>Create New Plan</Button>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => { fetchPlans(); }}>Refresh</Button>
          </div>
        </div>
        {loading ? (
          <p>Se încarcă...</p>
        ) : plans.length === 0 ? (
          <p className="text-muted-foreground">No meal plans yet.</p>
        ) : (
          <ul className="space-y-2">
            {plans.map((p) => (
              <li key={p.id} className="border rounded p-3" onClick={() => handlePlanClick(p)}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-sm text-muted-foreground">{p.dateRange} | {p.recipeCount} recipes | {p.createdDate}</div>
                  </div>
                  <div className="flex gap-2">
                    {editingId === p.id ? (
                      <div className="flex gap-2 items-center">
                        <Input className="border rounded px-2 py-1" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
                        <Button variant="outline" size="sm" onClick={() => { if (editingTitle && editingTitle !== p.title) updatePlan(p.id, editingTitle, []); setEditingId(null); }}>Save</Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleEditPlan(p.id)}>Rename</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeletePlan(p.id)}>Delete</Button>
                      </>
                    )}
                  </div>
                </div>
                {isExpanded && selectedPlan?.id === p.id && (
                  <div className="mt-4 p-4 border rounded">
                    <Button onClick={handleGenerateShoppingList} className="mt-2">Generate Shopping List</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Meal Plan</DialogTitle>
        </DialogHeader>
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Enter meal plan name" className="mb-4" />
        <DialogFooter>
          <Button onClick={handleCreatePlan}>Create</Button>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main>
);


}
