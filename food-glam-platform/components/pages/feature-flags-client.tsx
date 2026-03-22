"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function FeatureFlagsClient() {
  const { flags, loading } = useFeatureFlags();
  const healthMode = !!flags.healthMode;
  const powerMode = !!flags.powerMode;
  const fasting = !!flags.fasting;
  const foodLogging = !!flags.foodLogging;
  const nutritionComputed = !!flags.nutritionComputed;
  const micronutrients = !!flags.micronutrients;
  const pantry = !!flags.pantry;

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;
  }
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="mb-4">
            <li>Health Mode: {healthMode ? "Enabled" : "Disabled"}</li>
            <li>Power Mode: {powerMode ? "Enabled" : "Disabled"}</li>
            <li>Fasting: {fasting ? "Enabled" : "Disabled"}</li>
            <li>Food Logging: {foodLogging ? "Enabled" : "Disabled"}</li>
            <li>Nutrition Computed: {nutritionComputed ? "Enabled" : "Disabled"}</li>
            <li>Micronutrients: {micronutrients ? "Enabled" : "Disabled"}</li>
            <li>Pantry: {pantry ? "Enabled" : "Disabled"}</li>
          </ul>
          <p className="text-muted-foreground">Toggle advanced features in your profile settings to unlock more modules and tools.</p>
        </CardContent>
      </Card>
    </main>
  );
}
