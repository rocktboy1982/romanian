"use client";

import React from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function RecipeDbStrategyScrapeImportClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  if (loading) return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Recipe DB Strategy, Scrape & Import</CardTitle>
        </CardHeader>
        <CardContent>
          {!powerMode ? (
            <>
              <p className="text-muted-foreground mb-4">Power Mode is off. Enable Power Mode to view and manage advanced recipe database, scraping, and import features.</p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors">Enable Power Mode</button>
            </>
          ) : (
            <>
              <p className="mb-2">Scrape recipes, import data, and manage the recipe database.</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
