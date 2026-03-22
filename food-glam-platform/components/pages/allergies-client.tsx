"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function AllergiesClient() {
  const { flags, loading } = useFeatureFlags();
  const healthMode = !!flags.healthMode;

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;
  }
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Allergies & Safety</CardTitle>
        </CardHeader>
        <CardContent>
          {!healthMode ? (
            <>
              <p className="text-muted-foreground mb-4">Health Mode is off. Enable Health Mode to set allergens, conditions, and get safety warnings.</p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors">Enable Health Mode</button>
            </>
          ) : (
            <>
              <p className="mb-2">Set your allergens, intolerances, and conditions. Get warnings and filter recipes accordingly.</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
