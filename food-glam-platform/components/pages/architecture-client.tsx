"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function ArchitectureClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;
  }
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Platform Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          {!powerMode ? (
            <>
              <p className="text-muted-foreground mb-4">Power Mode is off. Enable Power Mode to view advanced architecture diagrams and platform specs.</p>
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors">Enable Power Mode</button>
            </>
          ) : (
            <>
              <p className="mb-2">Explore platform architecture, modular design, and integration points.</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
