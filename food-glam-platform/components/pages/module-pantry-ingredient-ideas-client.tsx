"use client";

import React from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ModulePantryIngredientIdeasClient() {
  const { flags, loading } = useFeatureFlags();
  const pantryMode = !!flags.pantry;

  if (loading) return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Pantry & Ingredient Ideas</CardTitle>
        </CardHeader>
        <CardContent>
          {!pantryMode ? (
            <>
              <p className="text-muted-foreground mb-4">Pantry Mode is off. Enable Pantry Mode to view and manage advanced pantry and ingredient features.</p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors">Enable Pantry Mode</button>
            </>
          ) : (
            <>
              <p className="mb-2">Track pantry items, discover ingredient ideas, and optimize shopping.</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
