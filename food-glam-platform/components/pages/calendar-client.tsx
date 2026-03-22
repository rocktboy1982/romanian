"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function CalendarClient() {
  const { flags, loading } = useFeatureFlags();
  const healthMode = !!flags.healthMode;

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;
  }
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Calendar & Timeframe</CardTitle>
        </CardHeader>
        <CardContent>
          {!healthMode ? (
            <>
              <p className="text-muted-foreground mb-4">Health Mode is off. Enable Health Mode to unlock week view, nutrition rollups, and cook-time planning.</p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors">Enable Health Mode</button>
            </>
          ) : (
            <>
              <p className="mb-2">Plan your meals with a week view, nutrition rollups, and cook-time planning.</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
