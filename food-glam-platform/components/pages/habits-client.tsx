"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function HabitsClient() {
  const { flags, loading } = useFeatureFlags();
  const healthMode = !!flags.healthMode;

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;
  }
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Habits & Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          {!healthMode ? (
            <>
              <p className="text-muted-foreground mb-4">Health Mode is off. Enable Health Mode to track daily habits and receive reminders.</p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors">Enable Health Mode</button>
            </>
          ) : (
            <>
              <p className="mb-2">Create daily habit checklists and mark completion. Optional reminders available.</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
