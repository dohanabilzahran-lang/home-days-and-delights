import { addDays, isoWeekday } from "@/lib/recurrence";

export const SLOTS = ["breakfast", "lunch", "dinner", "snack", "lunchbox"] as const;
export type Slot = (typeof SLOTS)[number];

/** Saturday that starts the week containing `date` (the week runs Saturday → Friday in Egypt). */
export function weekStart(date: string) {
  const back = (isoWeekday(date) + 1) % 7; // Sat → 0, Sun → 1 … Fri → 6
  return addDays(date, -back);
}
export const weekDates = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

const UNITS: Record<string, string> = {
  g: "g", gm: "g", gram: "g", grams: "g", "جم": "g", "جرام": "g",
  kg: "kg", kilo: "kg", kilos: "kg", "كجم": "kg", "كيلو": "kg",
  ml: "ml", "مل": "ml",
  l: "l", liter: "l", litre: "l", liters: "l", "لتر": "l",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", "ملعقة": "tbsp",
  cup: "cup", cups: "cup", "كوب": "cup", "كوبين": "cup",
  pc: "pc", pcs: "pc", piece: "pc", pieces: "pc", "حبة": "pc", "حبات": "pc",
};

const toNumber = (s: string) => {
  const western = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace("،", ".").replace(",", ".");
  if (/^\d+\/\d+$/.test(western)) {
    const [a, b] = western.split("/").map(Number) as [number, number];
    return b ? a / b : NaN;
  }
  return Number(western);
};

/**
 * Reads one ingredient line: "2 kg rice" → { quantity: 2, unit: "kg", name: "rice" };
 * "3 eggs" → { quantity: 3, unit: null, name: "eggs" }; "salt" → { quantity: null, unit: null, name: "salt" }.
 * Arabic digits and common Arabic units are understood.
 */
export function parseIngredient(line: string) {
  const clean = line.trim().replace(/^[-•*]\s*/, "");
  const m = clean.match(/^([\d٠-٩]+(?:[.,،/][\d٠-٩]+)?)\s*(.*)$/);
  if (!m) return { quantity: null, unit: null, name: clean };
  const quantity = toNumber(m[1] ?? "");
  let rest = (m[2] ?? "").trim();
  let unit: string | null = null;
  const first = rest.split(/\s+/)[0] ?? "";
  const known = UNITS[first.toLowerCase()];
  if (known) {
    unit = known;
    rest = rest.slice(first.length).trim().replace(/^(of|من)\s+/i, "");
  }
  return { quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null, unit, name: rest || clean };
}

export const nameKey = (name: string) => name.trim().toLowerCase();

export type Ingredient = { recipe_id: string; name: string; quantity: number | null; unit: string | null };
export type Suggestion = { key: string; name: string; quantity: number | null; unit: string | null; recipes: string[]; onList: boolean };

/**
 * Consolidated shopping suggestions for planned meals: the same ingredient in the same unit is added up
 * across recipes ("onion" ×3 recipes → one line). Items already on the list are flagged, not dropped,
 * so the user decides. Nothing is written until the user approves.
 */
export function consolidate(
  entries: { recipe_id: string | null }[],
  recipes: { id: string; title: string }[],
  ingredients: Ingredient[],
  neededNames: string[],
): Suggestion[] {
  const onList = new Set(neededNames.map(nameKey));
  const out = new Map<string, Suggestion>();
  for (const e of entries) {
    if (!e.recipe_id) continue;
    const recipe = recipes.find((r) => r.id === e.recipe_id);
    for (const ing of ingredients.filter((i) => i.recipe_id === e.recipe_id)) {
      const key = `${nameKey(ing.name)}|${ing.unit ?? ""}`;
      const cur = out.get(key);
      if (cur) {
        cur.quantity = cur.quantity !== null && ing.quantity !== null ? cur.quantity + ing.quantity : cur.quantity ?? ing.quantity;
        if (recipe && !cur.recipes.includes(recipe.title)) cur.recipes.push(recipe.title);
      } else {
        out.set(key, {
          key, name: ing.name.trim(), quantity: ing.quantity, unit: ing.unit,
          recipes: recipe ? [recipe.title] : [], onList: onList.has(nameKey(ing.name)),
        });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}
