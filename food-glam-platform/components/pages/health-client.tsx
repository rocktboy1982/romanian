"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useFeatureFlags } from "@/components/feature-flags-provider";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_WEIGHT_LOG = [
  { date: "2026-01-05", kg: 84.2 },
  { date: "2026-01-12", kg: 83.8 },
  { date: "2026-01-19", kg: 83.1 },
  { date: "2026-01-26", kg: 82.5 },
  { date: "2026-02-02", kg: 82.0 },
  { date: "2026-02-09", kg: 81.6 },
  { date: "2026-02-16", kg: 81.2 },
];

const MOCK_MEASUREMENTS = [
  { label: "Waist", value: "88 cm", change: "-2 cm" },
  { label: "Chest", value: "101 cm", change: "-1 cm" },
  { label: "Hips", value: "96 cm", change: "-1 cm" },
  { label: "Body Fat", value: "19%", change: "-1%" },
];

type WeightEntry = { date: string; kg: number };
type GoalTab = "weight" | "calories" | "macros" | "measurements";

// ─── Mini bar chart for weight trend ─────────────────────────────────────────

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length === 0) return null;
  const min = Math.min(...entries.map((e) => e.kg)) - 1;
  const max = Math.max(...entries.map((e) => e.kg)) + 1;
  const range = max - min;
  const height = 80;

  return (
    <div className="flex items-end gap-1.5 h-20 mt-2">
      {entries.map((e, i) => {
        const barH = Math.round(((e.kg - min) / range) * height);
        const isLast = i === entries.length - 1;
        return (
          <div key={e.date} className="flex flex-col items-center flex-1 group">
            <div
              className={`w-full rounded-t-sm transition-all ${isLast ? "bg-amber-500" : "bg-amber-200"}`}
              style={{ height: `${barH}px` }}
              title={`${e.kg} kg`}
            />
            <span className="text-[9px] text-muted-foreground mt-0.5 group-hover:text-foreground">
              {e.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HealthClient() {
  const { flags, loading, setOverride } = useFeatureFlags();
  const healthMode = !!flags.healthMode;

  const [activeTab, setActiveTab] = useState<GoalTab>("weight");

  // Weight goal form state
  const [currentWeight, setCurrentWeight] = useState("81.2");
  const [targetWeight, setTargetWeight] = useState("75.0");
  const [heightCm, setHeightCm] = useState("178");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [weightLog, setWeightLog] = useState<WeightEntry[]>(MOCK_WEIGHT_LOG);
  const [newWeightInput, setNewWeightInput] = useState("");

  // Calories state
  // Calories state — persisted to localStorage so meal planner can read them
  const [calorieTarget, setCalorieTargetRaw] = useState(() => {
    if (typeof window === "undefined") return "2100"
    return localStorage.getItem("health-calorie-target") ?? "2100"
  });
  const [calorieGoal, setCalorieGoalRaw] = useState<"lose" | "maintain" | "gain">(() => {
    if (typeof window === "undefined") return "lose"
    return (localStorage.getItem("health-calorie-goal") as "lose" | "maintain" | "gain") ?? "lose"
  });

  // Macros state — persisted to localStorage
  const [macroProtein, setMacroProteinRaw] = useState(() => {
    if (typeof window === "undefined") return "35"
    return localStorage.getItem("health-macro-protein") ?? "35"
  });
  const [macroCarbs, setMacroCarbsRaw] = useState(() => {
    if (typeof window === "undefined") return "40"
    return localStorage.getItem("health-macro-carbs") ?? "40"
  });
  const [macroFat, setMacroFatRaw] = useState(() => {
    if (typeof window === "undefined") return "25"
    return localStorage.getItem("health-macro-fat") ?? "25"
  });

  // Persist health goals whenever they change
  useEffect(() => { localStorage.setItem("health-calorie-target", calorieTarget) }, [calorieTarget])
  useEffect(() => { localStorage.setItem("health-calorie-goal", calorieGoal) }, [calorieGoal])
  useEffect(() => { localStorage.setItem("health-macro-protein", macroProtein) }, [macroProtein])
  useEffect(() => { localStorage.setItem("health-macro-carbs", macroCarbs) }, [macroCarbs])
  useEffect(() => { localStorage.setItem("health-macro-fat", macroFat) }, [macroFat])

  const setCalorieTarget = (v: string) => setCalorieTargetRaw(v)
  const setCalorieGoal = (v: "lose" | "maintain" | "gain") => setCalorieGoalRaw(v)
  const setMacroProtein = (v: string) => setMacroProteinRaw(v)
  const setMacroCarbs = (v: string) => setMacroCarbsRaw(v)
  const setMacroFat = (v: string) => setMacroFatRaw(v)

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;
  }

  if (!healthMode) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Health & Weight Goals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="text-5xl">🏥</div>
            <p className="text-muted-foreground max-w-sm">
              Health Mode lets you set weight goals, log body measurements, track progress,
              and see calorie &amp; macro targets on your meal plans.
            </p>
            <button
              onClick={() => setOverride?.("healthMode", true)}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Enable Health Mode
            </button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // BMI calculation
  const bmi = heightCm && currentWeight
    ? (parseFloat(currentWeight) / Math.pow(parseFloat(heightCm) / 100, 2)).toFixed(1)
    : null;

  const toGo = (parseFloat(currentWeight) - parseFloat(targetWeight)).toFixed(1);
  const macroTotal = parseInt(macroProtein) + parseInt(macroCarbs) + parseInt(macroFat);

  const addWeightEntry = () => {
    const val = parseFloat(newWeightInput);
    if (isNaN(val) || val <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    setWeightLog((prev) => [...prev, { date: today, kg: val }]);
    setNewWeightInput("");
  };

  const tabs: { key: GoalTab; label: string; emoji: string }[] = [
    { key: "weight", label: "Weight", emoji: "⚖️" },
    { key: "calories", label: "Calories", emoji: "🔥" },
    { key: "macros", label: "Macros", emoji: "🥗" },
    { key: "measurements", label: "Body", emoji: "📏" },
  ];

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Health &amp; Goals</h1>
          <p className="text-sm text-muted-foreground">Track your progress privately.</p>
        </div>
        <button
          onClick={() => setOverride?.("healthMode", false)}
          className="text-xs text-muted-foreground border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          Disable Health Mode
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">{currentWeight}</div>
          <div className="text-xs text-muted-foreground">Current ({weightUnit})</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{targetWeight}</div>
          <div className="text-xs text-muted-foreground">Target ({weightUnit})</div>
        </Card>
        <Card className="p-4 text-center">
          <div className={`text-2xl font-bold ${parseFloat(toGo) > 0 ? "text-orange-500" : "text-green-600"}`}>
            {parseFloat(toGo) > 0 ? `-${toGo}` : "✓ Done"}
          </div>
          <div className="text-xs text-muted-foreground">To go ({weightUnit})</div>
        </Card>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Weight */}
      {activeTab === "weight" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weight Goal</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Height (cm)</label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                  <select
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value as "kg" | "lbs")}
                    className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="kg">kg</option>
                    <option value="lbs">lbs</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Current weight</label>
                  <input
                    type="number"
                    value={currentWeight}
                    onChange={(e) => setCurrentWeight(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Target weight</label>
                  <input
                    type="number"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
              {bmi && (
                <div className="text-sm bg-muted rounded-lg px-4 py-2 flex justify-between items-center">
                  <span>BMI</span>
                  <span className="font-semibold">{bmi}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weight Log</CardTitle>
            </CardHeader>
            <CardContent>
              <WeightChart entries={weightLog.slice(-8)} />
              <div className="mt-3 flex flex-col gap-1 max-h-40 overflow-y-auto text-sm">
                {[...weightLog].reverse().map((e, i) => (
                  <div key={i} className="flex justify-between py-1 border-b last:border-0 text-muted-foreground">
                    <span>{e.date}</span>
                    <span className="font-medium text-foreground">{e.kg} {weightUnit}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  placeholder={`Log today (${weightUnit})`}
                  value={newWeightInput}
                  onChange={(e) => setNewWeightInput(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={addWeightEntry}
                  className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  Log
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Calories */}
      {activeTab === "calories" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calorie Target</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              {(["lose", "maintain", "gain"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setCalorieGoal(g)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    calorieGoal === g
                      ? "bg-amber-500 text-white border-amber-500"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {g === "lose" ? "🔻 Lose" : g === "maintain" ? "⚖️ Maintain" : "📈 Gain"}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Daily calorie target</label>
              <input
                type="number"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="bg-muted rounded-lg p-4 text-sm flex flex-col gap-1">
              <div className="flex justify-between">
                <span>Goal</span>
                <span className="font-medium capitalize">{calorieGoal} weight</span>
              </div>
              <div className="flex justify-between">
                <span>Daily target</span>
                <span className="font-medium">{calorieTarget} kcal</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs mt-1">
                <span>Suggested weekly change</span>
                <span>{calorieGoal === "lose" ? "-0.5 kg/week" : calorieGoal === "gain" ? "+0.5 kg/week" : "±0"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Macros */}
      {activeTab === "macros" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Macro Targets</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Set your target macro split (%). These will appear as rollups on your meal plans.
            </p>
            {[
              { label: "Protein", emoji: "🥩", value: macroProtein, set: setMacroProtein, color: "text-red-500" },
              { label: "Carbs", emoji: "🌾", value: macroCarbs, set: setMacroCarbs, color: "text-amber-500" },
              { label: "Fat", emoji: "🫒", value: macroFat, set: setMacroFat, color: "text-yellow-600" },
            ].map(({ label, emoji, value, set, color }) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium">{emoji} {label}</label>
                  <span className={`text-sm font-bold ${color}`}>{value}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={70}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full accent-amber-500"
                />
              </div>
            ))}
            <div className={`text-xs rounded-lg px-4 py-2 ${macroTotal === 100 ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
              Total: {macroTotal}% {macroTotal === 100 ? "✓ Perfect" : macroTotal > 100 ? "— reduce by " + (macroTotal - 100) + "%" : "— add " + (100 - macroTotal) + "%"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Measurements */}
      {activeTab === "measurements" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Body Measurements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground mb-1">
              Log your body measurements to track non-scale victories.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {MOCK_MEASUREMENTS.map((m) => (
                <div key={m.label} className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                  <div className="text-lg font-semibold mt-0.5">{m.value}</div>
                  <div className="text-xs text-green-600 font-medium">{m.change} vs start</div>
                </div>
              ))}
            </div>
            <button className="mt-2 border border-dashed rounded-lg py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors w-full">
              + Log new measurements
            </button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
