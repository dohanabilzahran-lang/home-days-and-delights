import { describe, expect, it } from "vitest";
import { consolidate, parseIngredient, weekDates, weekStart } from "@/lib/meals";

describe("week", () => {
  it("starts on Saturday", () => expect(weekStart("2026-10-23")).toBe("2026-10-17")); // Fri → previous Sat
  it("a Saturday starts its own week", () => expect(weekStart("2026-10-24")).toBe("2026-10-24"));
  it("has 7 days ending Friday", () => expect(weekDates("2026-10-24").at(-1)).toBe("2026-10-30"));
});

describe("ingredient lines", () => {
  it("quantity, unit, name", () => expect(parseIngredient("2 kg rice")).toEqual({ quantity: 2, unit: "kg", name: "rice" }));
  it("count without unit", () => expect(parseIngredient("3 eggs")).toEqual({ quantity: 3, unit: null, name: "eggs" }));
  it("no quantity", () => expect(parseIngredient("salt")).toEqual({ quantity: null, unit: null, name: "salt" }));
  it("fractions and 'of'", () => expect(parseIngredient("1/2 cup of milk")).toEqual({ quantity: 0.5, unit: "cup", name: "milk" }));
  it("Arabic digits and units", () => expect(parseIngredient("٢ كيلو أرز")).toEqual({ quantity: 2, unit: "kg", name: "أرز" }));
  it("bullets are ignored", () => expect(parseIngredient("- 1 onion").name).toBe("onion"));
});

describe("shopping suggestions", () => {
  const recipes = [{ id: "a", title: "Koshari" }, { id: "b", title: "Molokhia" }];
  const ings = [
    { recipe_id: "a", name: "Onion", quantity: 2, unit: null },
    { recipe_id: "b", name: "onion", quantity: 1, unit: null },
    { recipe_id: "a", name: "Rice", quantity: 1, unit: "kg" },
    { recipe_id: "b", name: "Garlic", quantity: null, unit: null },
  ];
  const s = consolidate([{ recipe_id: "a" }, { recipe_id: "b" }, { recipe_id: null }], recipes, ings, ["rice"]);
  it("merges the same ingredient across recipes", () => {
    const onion = s.find((x) => x.name.toLowerCase() === "onion");
    expect(onion?.quantity).toBe(3);
    expect(onion?.recipes).toEqual(["Koshari", "Molokhia"]);
  });
  it("flags items already on the list instead of dropping them", () => expect(s.find((x) => x.name === "Rice")?.onList).toBe(true));
  it("keeps items with no quantity", () => expect(s.find((x) => x.name === "Garlic")?.quantity).toBeNull());
  it("counts a recipe planned twice twice", () => {
    const twice = consolidate([{ recipe_id: "a" }, { recipe_id: "a" }], recipes, ings, []);
    expect(twice.find((x) => x.name === "Onion")?.quantity).toBe(4);
  });
});
