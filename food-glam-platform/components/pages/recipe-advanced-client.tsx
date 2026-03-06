"use client";

import React from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { estimateRecipeCalories } from "@/lib/calorie-engine";

type NutritionData = {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

function MacroBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-12 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-12 text-right">{value}g</span>
      <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function RecipeAdvancedClient({
  nutrition,
  fasting,
  foodLog,
  ingredients,
}: {
  nutrition: NutritionData | null | undefined;
  fasting?: string;
  foodLog?: boolean;
  /** All ingredient strings from the recipe — used to compute per-ingredient calories */
  ingredients?: string[];
}) {
  const { flags, loading } = useFeatureFlags();
  const healthMode = !!flags.healthMode;

  if (loading) return null;

  if (!healthMode) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Nutriție avansată</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Activează Modul Sănătate pentru a vedea calorii, macronutrienți, post și funcții de jurnal alimentar.
          </p>
        </CardContent>
      </Card>
    );
  }

  const calories = nutrition?.calories ?? 0;
  const protein = nutrition?.protein ?? 0;
  const carbs = nutrition?.carbs ?? 0;
  const fat = nutrition?.fat ?? 0;
  const totalMacroG = protein + carbs + fat;
  const hasData = calories > 0 || totalMacroG > 0;

  // Per-ingredient calorie breakdown
  const ingredientList = ingredients ?? [];
  const { results: calorieResults, totalKcal: computedTotal, knownCount } =
    estimateRecipeCalories(ingredientList);
  const hasIngredientCalories = ingredientList.length > 0 && knownCount > 0;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          🔥 Nutriție <span className="text-xs font-normal text-muted-foreground">per porție</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* ── Macro summary (from recipe_json.nutrition_per_serving) ── */}
        {!hasData ? (
          <p className="text-sm text-muted-foreground">Datele nutriționale nu sunt disponibile pentru această rețetă.</p>
        ) : (
          <div className="space-y-4">
            {/* Calorie highlight */}
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-2xl font-bold text-amber-700">{calories}</p>
                <p className="text-xs text-amber-600">kcal / porție</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-sm font-semibold text-red-600">{protein}g</p>
                  <p className="text-[10px] text-muted-foreground">Proteine</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-600">{carbs}g</p>
                  <p className="text-[10px] text-muted-foreground">Carbohidrați</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-yellow-700">{fat}g</p>
                  <p className="text-[10px] text-muted-foreground">Grăsimi</p>
                </div>
              </div>
            </div>

            {/* Macro distribution bars */}
            {totalMacroG > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Distribuție macronutrienți
                </p>
                <MacroBar label="Proteine" value={protein} total={totalMacroG} color="bg-red-400" />
                <MacroBar label="Carbo"   value={carbs}   total={totalMacroG} color="bg-amber-400" />
                <MacroBar label="Grăsimi"     value={fat}     total={totalMacroG} color="bg-yellow-400" />
              </div>
            )}

            {/* Extra health info */}
            {(fasting || foodLog) && (
              <div className="border-t border-border pt-3 space-y-1 text-sm text-muted-foreground">
                {fasting && (
                  <div>
                    ⏱ Fereastră de post:{" "}
                    <span className="text-foreground font-medium">{fasting}</span>
                  </div>
                )}
                {foodLog && (
                  <div>
                    📓 Jurnal alimentar: <span className="text-foreground font-medium">Activat</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Per-ingredient calorie breakdown (USDA estimate) ── */}
        {hasIngredientCalories && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Calorii per ingredient
              </p>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                ~{computedTotal.toLocaleString()} kcal total
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Estimări USDA bazate pe cantitate și unitate.{" "}
              {knownCount < ingredientList.length && (
                <>{ingredientList.length - knownCount} ingredient(e) neidentificate.</>
              )}
            </p>
            <div className="space-y-1.5">
              {calorieResults.map((r, i) => {
                const pct = computedTotal > 0 && r.kcal !== null
                  ? Math.round((r.kcal / computedTotal) * 100)
                  : 0;
                return (
                  <div key={i} className="flex items-center gap-2 group">
                    {/* Ingredient label */}
                    <span
                      className="text-xs text-foreground truncate"
                      style={{ minWidth: 0, flex: "1 1 0" }}
                      title={ingredientList[i]}
                    >
                      {ingredientList[i]}
                    </span>

                    {/* Bar */}
                    {r.kcal !== null ? (
                      <>
                        <div className="flex-shrink-0 w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="flex-shrink-0 text-[11px] font-semibold text-amber-700 tabular-nums w-16 text-right">
                          {r.kcal} kcal
                        </span>
                      </>
                    ) : (
                      <span className="flex-shrink-0 text-[11px] text-muted-foreground/50 w-[calc(5rem+4rem+0.5rem)] text-right">
                        necunoscut
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
