"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function HydrationClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;
  }
  if (!powerMode) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Hydration & Water Intake</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Power Mode is off. Enable Power Mode to track water intake and hydration.</p>
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors">Enable Power Mode</button>
          </CardContent>
        </Card>
      </main>
    );
  }
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Hydration Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2">Log your daily water intake and monitor hydration.</p>
        </CardContent>
      </Card>
    </main>
  );
}
