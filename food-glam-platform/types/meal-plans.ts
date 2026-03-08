export interface MealEntry {
  id: string
  date: string
  meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  post_id: string
  servings: number
  recipe_title?: string
  recipe_image?: string
}

export interface MealsMeta {
  start_date?: string | null
  end_date?: string | null
}

export interface MealsData {
  _meta: MealsMeta
  entries: MealEntry[]
}

export interface MealPlan {
  id: string
  user_id: string
  title: string
  meals: MealsData | null
  created_at: string | null
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export const MEAL_SLOT_ICONS: Record<MealSlot, string> = {
  breakfast: '\u2600\uFE0F',   // sun
  lunch: '\uD83C\uDF1E',       // sun with face
  dinner: '\uD83C\uDF19',      // crescent moon
  snack: '\uD83C\uDF7F',       // popcorn
}

export interface ShoppingListItem {
  name: string
  amount: number
  unit: string
  recipe_titles: string[]
  category: string
}

export interface RecipePickerResult {
  post_id: string
  title: string
  hero_image_url: string | null
}
