"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFeatureFlags } from "@/components/feature-flags-provider";

// ─── Feature definitions ──────────────────────────────────────────────────────

type SubFeature = {
  key: string;
  label: string;
  emoji: string;
  description: string;
  href: string;
  requiresHealthMode?: boolean;
};

const POWER_FEATURES: SubFeature[] = [
  {
    key: "pantry",
    label: "Pantry",
    emoji: "🥫",
    description: "Track what's in your pantry and get recipe ideas from what you have.",
    href: "/pantry",
  },
  {
    key: "nutritionComputed",
    label: "Nutrition Engine",
    emoji: "🔬",
    description: "Auto-compute calories and macros for recipes and meal plans.",
    href: "/nutrition-engine",
  },
  {
    key: "micronutrients",
    label: "Micronutrients",
    emoji: "💊",
    description: "Detailed vitamin and mineral tracking per recipe and daily total.",
    href: "/micronutrients",
  },
  {
    key: "foodLogging",
    label: "Food Logging",
    emoji: "📓",
    description: "Log what you eat each day and see adherence to your meal plan.",
    href: "/food-logging",
  },
  {
    key: "fasting",
    label: "Fasting Planner",
    emoji: "⏱️",
    description: "Set fasting windows and track your fasting streaks.",
    href: "/habits",
    requiresHealthMode: true,
  },
];

const HEALTH_FEATURES: SubFeature[] = [
  {
    key: "healthMode",
    label: "Health Goals",
    emoji: "🏥",
    description: "Weight goals, calorie targets, macro rollups, body measurements and progress log.",
    href: "/health",
    requiresHealthMode: true,
  },
  {
    key: "hydration",
    label: "Hydration Tracker",
    emoji: "💧",
    description: "Set a daily water intake goal and log glasses throughout the day.",
    href: "/hydration",
    requiresHealthMode: true,
  },
];

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function FeatureRow({
  feature,
  enabled,
  onToggle,
  locked,
}: {
  feature: SubFeature;
  enabled: boolean;
  onToggle: () => void;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="text-2xl mt-0.5 select-none">{feature.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{feature.label}</span>
          {locked && (
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              Needs Health Mode
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{feature.description}</p>
        {enabled && !locked && (
          <Link
            href={feature.href}
            className="text-xs text-amber-600 font-medium hover:underline mt-1 inline-block"
          >
            Open →
          </Link>
        )}
      </div>
      <button
        onClick={onToggle}
        disabled={locked}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none mt-0.5 ${
          enabled ? "bg-primary" : locked ? "bg-muted-foreground/20 cursor-not-allowed" : "bg-muted-foreground/30"
        }`}
        aria-pressed={enabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdvancedClient() {
  const { flags, loading, setOverride } = useFeatureFlags();
  const healthMode = !!flags.healthMode;
  const powerMode = !!flags.powerMode;

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;
  }

  if (!powerMode) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Power Mode</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="text-5xl">⚡</div>
            <p className="text-muted-foreground max-w-sm">
              Power Mode unlocks advanced features — pantry management, nutrition engine,
              micronutrient tracking, food logging, and fasting tools.
            </p>
            <button
              onClick={() => setOverride?.("powerMode", true)}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Enable Power Mode
            </button>
            <p className="text-xs text-muted-foreground">
              These features stay out of the way until you need them.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const toggle = (key: string, current: boolean) => {
    setOverride?.(key, !current);
  };

  const enabledCount = POWER_FEATURES.filter((f) => !!flags[f.key]).length
    + HEALTH_FEATURES.filter((f) => !!flags[f.key]).length;
  const totalCount = POWER_FEATURES.length + HEALTH_FEATURES.length;

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">⚡ Power Mode</h1>
          <p className="text-sm text-muted-foreground">
            {enabledCount} of {totalCount} advanced features enabled.
          </p>
        </div>
        <button
          onClick={() => setOverride?.("powerMode", false)}
          className="text-xs text-muted-foreground border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          Disable Power Mode
        </button>
      </div>

      {/* Power Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">⚡ Power Features</CardTitle>
        </CardHeader>
        <CardContent className="py-0 divide-y">
          {POWER_FEATURES.map((f) => (
            <FeatureRow
              key={f.key}
              feature={f}
              enabled={!!flags[f.key]}
              onToggle={() => toggle(f.key, !!flags[f.key])}
              locked={f.requiresHealthMode && !healthMode}
            />
          ))}
        </CardContent>
      </Card>

      {/* Health Features */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">🏥 Health Features</CardTitle>
            {!healthMode && (
              <button
                onClick={() => setOverride?.("healthMode", true)}
                className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Enable Health Mode
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-0 divide-y">
          {HEALTH_FEATURES.map((f) => (
            <FeatureRow
              key={f.key}
              feature={f}
              enabled={!!flags[f.key]}
              onToggle={() => toggle(f.key, !!flags[f.key])}
              locked={f.requiresHealthMode && !healthMode}
            />
          ))}
        </CardContent>
      </Card>

      {/* Quick navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔗 Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {[...POWER_FEATURES, ...HEALTH_FEATURES]
              .filter((f) => !!flags[f.key] && !(f.requiresHealthMode && !healthMode))
              .map((f) => (
                <Link
                  key={f.key}
                  href={f.href}
                  className="rounded-lg border p-3 hover:bg-muted transition-colors text-sm font-medium text-center"
                >
                  {f.emoji} {f.label}
                </Link>
              ))}
            {[...POWER_FEATURES, ...HEALTH_FEATURES].filter(
              (f) => !!flags[f.key] && !(f.requiresHealthMode && !healthMode)
            ).length === 0 && (
              <p className="col-span-2 text-xs text-muted-foreground text-center py-2">
                Enable sub-features above to see quick access links here.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feature flag overview */}
      <div className="text-xs text-muted-foreground border rounded-lg px-4 py-3 flex flex-wrap gap-2">
        {Object.entries(flags).map(([key, val]) => (
          <span
            key={key}
            className={`px-2 py-0.5 rounded-full ${val ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}
          >
            {key}: {val ? "on" : "off"}
          </span>
        ))}
      </div>
    </main>
  );
}
