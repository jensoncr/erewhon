// Catalog access uses the same public, search-only Algolia credentials that
// erewhon.com ships to every browser. Read-only: we never write to Erewhon.
const ALGOLIA_APP_ID = "Y98RSJCJDH";
const ALGOLIA_SEARCH_KEY = "107758089d485c894f7205d715457357";

export type Store = { key: string; name: string; index: string };

export const STORES: Store[] = [
  { key: "GROVE", name: "Grove (Beverly Blvd)", index: "GROVE_SEARCH_INDEX" },
  { key: "BH", name: "Beverly Hills", index: "BH_SEARCH_INDEX" },
  { key: "CBS", name: "Calabasas", index: "CBS_SEARCH_INDEX" },
  { key: "CC", name: "Culver City", index: "CC_SEARCH_INDEX" },
  { key: "GD", name: "Glendale", index: "GD_SEARCH_INDEX" },
  { key: "MB", name: "Manhattan Beach", index: "MB_SEARCH_INDEX" },
  { key: "PAS", name: "Pasadena", index: "PAS_SEARCH_INDEX" },
  { key: "SM", name: "Santa Monica", index: "SM_SEARCH_INDEX" },
  { key: "SL", name: "Silver Lake", index: "SL_SEARCH_INDEX" },
  { key: "SC", name: "Studio City", index: "SC_SEARCH_INDEX" },
  { key: "VEN", name: "Venice", index: "VEN_SEARCH_INDEX" },
  { key: "WH", name: "West Hollywood", index: "WH_SEARCH_INDEX" },
];

export function storeByKey(key: string): Store {
  return STORES.find((s) => s.key === key) ?? STORES[0];
}

export type ProductHit = {
  objectID: string;
  ProductName: string;
  BrandName: string;
  Category: string;
  SubCategory: string;
  Size: string;
  Price: number;
  ImageFileName: string;
  Description?: string;
  Attributes?: string[];
  has_modifier?: boolean;
  delivery?: { Price: number };
};

export type ModifierChoice = {
  id: string;
  label: string;
  price: number;
  maximum: number;
};

export type ModifierGroup = {
  id: string;
  label: string;
  type: "radio" | "checkbox";
  minimum: number;
  maximum: number;
  choices: ModifierChoice[];
};

export type ModifierSize = {
  id: string;
  label: string;
  price: number;
  groups: ModifierGroup[];
};

export type ProductOptions = {
  productId: string;
  productName: string;
  groups: ModifierGroup[];
  modifierSizes: ModifierSize[];
  requiresSelection: boolean;
};

export type ItemConfiguration = {
  modifierSize?: {
    id: string;
    label: string;
    price: number;
  };
  selections: Array<{
    groupId: string;
    groupLabel: string;
    optionId: string;
    optionLabel: string;
    price: number;
    quantity: number;
  }>;
};

/** A product the store no longer sells today — distinct from a network fault,
 *  so the UI can retire the card instead of firing an error toast. */
export class ProductUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductUnavailableError";
  }
}

// Erewhon indexes every product with the ISO weekdays it is actually sold
// (1 = Monday … 7 = Sunday). Rotating hot-bar specials — Miso Black Cod on
// Wed/Fri, taquitos on Tue/Sat — are in the index every day but reject
// add-to-cart on the other five. Filtering every query on today's weekday is
// what keeps unavailable items out of the menu in the first place.
function todayFacet(): string {
  const day = new Date().getDay();
  return `DayOfWeek:${day === 0 ? 7 : day}`;
}

type QueryResult = { hits: ProductHit[]; nbHits: number; nbPages: number };

async function algoliaQuery(
  index: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<QueryResult> {
  const res = await fetch(
    `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${index}/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Algolia-Application-Id": ALGOLIA_APP_ID,
        "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY,
      },
      body: JSON.stringify(body),
      signal,
    },
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return (await res.json()) as QueryResult;
}

async function algoliaBatch(
  requests: { indexName: string; params: Record<string, string> }[],
  signal?: AbortSignal,
): Promise<QueryResult[]> {
  const res = await fetch(
    `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Algolia-Application-Id": ALGOLIA_APP_ID,
        "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY,
      },
      body: JSON.stringify({
        requests: requests.map((request) => ({
          indexName: request.indexName,
          params: new URLSearchParams(request.params).toString(),
        })),
      }),
      signal,
    },
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as { results: QueryResult[] };
  return data.results;
}

// ── Menu ───────────────────────────────────────────────────────────────────
// Sections mirror how the store is actually laid out, so "the hot bar" in
// Slack and "Hot Bar" here are the same thing. Facets are OR-ed within a
// section and AND-ed against today's weekday.

export type MenuSection = {
  key: string;
  label: string;
  blurb: string;
  facets: string[];
  /** Preferred order for the subsection headings inside this section. */
  subOrder?: string[];
};

export const MENU_SECTIONS: MenuSection[] = [
  {
    key: "hot-bar",
    label: "Hot Bar",
    blurb: "Mains and sides from the hot case, cooked in-store today",
    facets: ["Category:Hot Case"],
    subOrder: ["Hot Main", "Hot Sides"],
  },
  {
    key: "cold-bar",
    label: "Cold Bar",
    blurb: "Salads, cold proteins and sides from the cold case",
    facets: ["Category:Cold Case"],
    subOrder: [
      "Fresh Salads",
      "Daytime Salads",
      "Cold Proteins",
      "Cold Sides",
      "Packaged Salads",
    ],
  },
  {
    key: "sandwiches",
    label: "Sandwiches & Wraps",
    blurb: "Made in-house, wrapped and ready to go",
    facets: ["Category:Sandwiches & Wraps"],
    subOrder: ["Sandwiches", "Wraps"],
  },
  {
    key: "sushi",
    label: "Sushi",
    blurb: "Rolls, sashimi and sides from the sushi counter",
    facets: ["Category:Sushi"],
    subOrder: ["Rolls", "Sushi & Sashimi", "Sushi Sides"],
  },
  {
    key: "combo",
    label: "Combo Plates",
    blurb: "Pick a main and two sides — options chosen when you add it",
    facets: ["Category:Combo Plates"],
  },
  {
    key: "soup",
    label: "Soup",
    blurb: "Fresh soups, ladled by the cup or the quart",
    facets: ["Category:Soup"],
  },
  {
    key: "breakfast",
    label: "Breakfast",
    blurb: "Burritos, oats, tartines and breakfast sandwiches",
    facets: ["Category:Breakfast"],
    subOrder: [
      "Breakfast Burritos",
      "Breakfast Sandwich",
      "Breakfast Entrees",
      "Oats",
      "Tartines & Toasts",
      "Breakfast Sides",
    ],
  },
  {
    key: "tonic-bar",
    label: "Tonic Bar",
    blurb: "Smoothies, coffee, matcha, juices, tonics and bowls",
    facets: ["Department:Tonic"],
    subOrder: [
      "Signatures",
      "Classics",
      "Acai & Bowls",
      "Hot Coffee",
      "Iced Coffee",
      "Matcha",
      "Hot Tea",
      "Iced Tea",
      "Fresh Juices",
      "Tonics",
      "Bone Broths",
      "Ice Creams",
      "Mousse",
    ],
  },
  {
    key: "bakery",
    label: "Bakery",
    blurb: "Pastries, loaves, cakes and cookies",
    facets: ["Category:Bakery", "Category:Baked Goods"],
    subOrder: ["Baked Goods", "Sweet Loaves", "Cakes & Pies"],
  },
  {
    key: "drinks",
    label: "Cold Drinks",
    blurb: "Kombucha, sparkling water, cold brew, shots and functionals",
    facets: [
      "FilterName:Kombucha",
      "FilterName:Cold Pressed",
      "FilterName:Shots",
      "FilterName:Sparkling Water",
      "FilterName:Water",
      "FilterName:Carbonated Drinks",
      "FilterName:Coffee Drinks",
      "FilterName:Tea Drinks",
      "FilterName:Protein Drinks",
      "FilterName:Other Functional Drinks",
    ],
  },
  {
    key: "snacks",
    label: "Snacks",
    blurb: "Chips, bars, chocolate and cookies for the table",
    facets: [
      "SubCategory:Chips & Salty Snacks",
      "SubCategory:Snack Bars",
      "SubCategory:Chocolate & Candies",
      "SubCategory:Cookies & Desserts",
      "SubCategory:Nuts & Trail Mix",
    ],
  },
];

export type Meal = "breakfast" | "lunch";

export function currentMeal(): Meal {
  return new Date().getHours() < 11 ? "breakfast" : "lunch";
}

// Same sections either way — the meal only decides what you see first.
const MEAL_ORDER: Record<Meal, string[]> = {
  breakfast: [
    "breakfast",
    "tonic-bar",
    "bakery",
    "hot-bar",
    "cold-bar",
    "sandwiches",
    "sushi",
    "soup",
    "combo",
    "drinks",
    "snacks",
  ],
  lunch: [
    "hot-bar",
    "cold-bar",
    "sandwiches",
    "sushi",
    "combo",
    "soup",
    "tonic-bar",
    "drinks",
    "snacks",
    "bakery",
    "breakfast",
  ],
};

export function sectionsForMeal(meal: Meal): MenuSection[] {
  const order = MEAL_ORDER[meal];
  return [...MENU_SECTIONS].sort(
    (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
  );
}

export const MENU_PAGE_SIZE = 48;

/** How many items each section has for sale today, in one request. Sections
 *  that come back empty are hidden rather than shown as a dead end. */
export async function menuSectionCounts(
  index: string,
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const day = todayFacet();
  const results = await algoliaBatch(
    MENU_SECTIONS.map((section) => ({
      indexName: index,
      params: {
        query: "",
        hitsPerPage: "0",
        facetFilters: JSON.stringify([section.facets, [day]]),
      },
    })),
    signal,
  );
  const counts: Record<string, number> = {};
  MENU_SECTIONS.forEach((section, i) => {
    counts[section.key] = results[i]?.nbHits ?? 0;
  });
  return counts;
}

export async function browseMenuSection(
  index: string,
  section: MenuSection,
  page: number,
  signal?: AbortSignal,
): Promise<{ hits: ProductHit[]; nbHits: number; nbPages: number }> {
  return algoliaQuery(
    index,
    {
      query: "",
      hitsPerPage: MENU_PAGE_SIZE,
      page,
      facetFilters: [section.facets, [todayFacet()]],
    },
    signal,
  );
}

export type SearchResult = {
  hits: ProductHit[];
  /** Matches that exist but are not sold today — surfaced as a note so the
   *  filter never looks like a broken search. */
  hiddenToday: number;
};

export async function searchProducts(
  index: string,
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const [available, all] = await algoliaBatch(
    [
      {
        indexName: index,
        params: {
          query,
          hitsPerPage: "24",
          facetFilters: JSON.stringify([[todayFacet()]]),
        },
      },
      { indexName: index, params: { query, hitsPerPage: "0" } },
    ],
    signal,
  );
  return {
    hits: available?.hits ?? [],
    hiddenToday: Math.max(0, (all?.nbHits ?? 0) - (available?.nbHits ?? 0)),
  };
}

export async function getProductOptions(
  storeKey: string,
  productId: string,
  signal?: AbortSignal,
): Promise<ProductOptions> {
  const params = new URLSearchParams({ storeKey, productId });
  const response = await fetch(`/api/erewhon-cart?${params}`, {
    cache: "no-store",
    signal,
  });
  const payload = (await response.json()) as ProductOptions & { error?: string };
  if (!response.ok) {
    const message = payload.error || "Could not load this product's options";
    // 409 is Erewhon itself saying the product is gone for today.
    if (response.status === 409) throw new ProductUnavailableError(message);
    throw new Error(message);
  }
  return payload;
}

export function effectivePrice(hit: ProductHit): number {
  return hit.delivery?.Price ?? hit.Price;
}

export function dietaryTags(hit: ProductHit): string[] {
  return (hit.Attributes ?? []).filter(Boolean);
}

// A uniformly random in-stock product under maxPrice, via a random page of a
// filtered empty query. Pagination caps at 1000 single-hit pages.
export async function randomProductUnder(
  index: string,
  maxPrice: number,
): Promise<ProductHit | null> {
  const filters = [`Price>0`, `Price<${maxPrice}`];
  let pageCount = 1000;
  for (let attempt = 0; attempt < 4; attempt++) {
    const page = Math.floor(Math.random() * pageCount);
    const data = await algoliaQuery(index, {
      query: "",
      hitsPerPage: 1,
      page,
      numericFilters: filters,
      facetFilters: [[todayFacet()]],
    });
    pageCount = Math.max(1, Math.min(pageCount, data.nbPages));
    const hit = data.hits[0];
    // The filter covers pickup price; re-check the delivery price we display.
    if (hit && effectivePrice(hit) < maxPrice) return hit;
  }
  return null;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

export function productUrl(productId: string, productName: string): string {
  return `https://erewhon.com/product/${productId}/${slugify(productName)}`;
}

export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}
