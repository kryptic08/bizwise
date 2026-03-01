/**
 * Business-type-aware expense categorization engine.
 *
 * Different businesses classify the same item differently:
 *  - Chicken in a Food Business → Raw Materials (used to cook)
 *  - Chicken in a Meat Shop     → Merchandise Inventory (sold as-is)
 *
 * This module provides:
 *  1. Per-business-type category lists
 *  2. Keyword-based categorization with business context
 *  3. AI prompt context string injected into Gemini/OCR calls
 */

import { BusinessType } from "../context/AuthContext";

// ── Category definitions ────────────────────────────────────────────────────

export interface CategoryDefinition {
  name: string;
  description: string;
}

/**
 * Returns the ordered list of expense categories relevant to the given
 * business type.  "General" is always included as a fallback.
 */
export function getCategoriesForBusinessType(
  businessType?: BusinessType | string | null,
): string[] {
  switch (businessType) {
    case "Food Business":
      return [
        "Raw Materials",
        "Packaging Materials",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Transportation",
        "General",
      ];

    case "Meat Shop":
      return [
        "Merchandise Inventory",
        "Store Supplies",
        "Packaging Materials",
        "Utilities",
        "Equipment",
        "Transportation",
        "General",
      ];

    case "Printing Services":
      return [
        "Raw Materials", // ink, paper, toner
        "Equipment", // printers, cutters, laminators
        "Store Supplies",
        "Packaging Materials",
        "Utilities",
        "Transportation",
        "General",
      ];

    case "Construction":
      return [
        "Construction Materials", // cement, steel, lumber
        "Equipment", // tools, heavy machinery
        "Labor & Subcontracting",
        "Transportation",
        "Store Supplies",
        "Utilities",
        "General",
      ];

    case "Retail":
      return [
        "Merchandise Inventory", // items bought for resale
        "Store Supplies",
        "Packaging Materials",
        "Utilities",
        "Equipment",
        "Transportation",
        "General",
      ];

    default:
      // "Others" or unknown
      return [
        "Raw Materials",
        "Merchandise Inventory",
        "Packaging Materials",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Transportation",
        "General",
      ];
  }
}

// ── Keyword maps ────────────────────────────────────────────────────────────

type KeywordMap = Record<string, string[]>;

/**
 * Base keyword map shared across all business types.
 * Business-specific overrides are applied on top.
 */
const BASE_KEYWORDS: KeywordMap = {
  "Packaging Materials": [
    "packaging",
    "package",
    "box",
    "container",
    "bag",
    "plastic",
    "wrapper",
    "carton",
    "bottle",
    "can",
    "jar",
    "pouch",
    "foil",
    "cellophane",
    "paper bag",
    "styrofoam",
    "cup",
    "lid",
    "straw",
    "tissue",
    "napkin",
    "tape",
    "label",
    "sticker",
    "seal",
  ],
  "Store Supplies": [
    "supplies",
    "cleaning",
    "detergent",
    "soap",
    "mop",
    "broom",
    "brush",
    "sponge",
    "towel",
    "gloves",
    "apron",
    "uniform",
    "pen",
    "paper",
    "notebook",
    "calculator",
    "stapler",
    "scissors",
    "marker",
    "office",
    "sanitizer",
    "disinfectant",
    "bleach",
  ],
  Utilities: [
    "electricity",
    "water",
    "bill",
    "internet",
    "phone",
    "cable",
    "wifi",
    "utility",
    "electric",
    "pldt",
    "smart",
    "globe",
    "meralco",
    "maynilad",
    "manila water",
    "converge",
    "sky",
    "cignal",
    "kwh",
    "kilowatt",
    "consumption",
  ],
  Equipment: [
    "equipment",
    "machine",
    "device",
    "appliance",
    "refrigerator",
    "oven",
    "microwave",
    "blender",
    "mixer",
    "fan",
    "aircon",
    "ac",
    "freezer",
    "stove",
    "grill",
    "fryer",
    "cutter",
    "slicer",
    "scale",
    "register",
    "pos",
    "tools",
    "hardware",
  ],
  Transportation: [
    "gas",
    "gasoline",
    "fuel",
    "diesel",
    "taxi",
    "uber",
    "grab",
    "bus",
    "train",
    "parking",
    "toll",
    "tricycle",
    "petron",
    "shell",
    "caltex",
    "phoenix",
    "seaoil",
    "fare",
    "transpo",
    "vehicle",
    "motor",
    "liter",
    "litre",
    "delivery",
    "shipping",
  ],
};

/**
 * Keywords for "Raw Materials" — used in food/printing businesses where
 * items like chicken, oil, flour are inputs to production.
 */
const RAW_MATERIAL_KEYWORDS: string[] = [
  "raw",
  "material",
  "ingredient",
  "flour",
  "sugar",
  "salt",
  "oil",
  "meat",
  "fish",
  "vegetable",
  "fruit",
  "grain",
  "spice",
  "seasoning",
  "fresh",
  "produce",
  "poultry",
  "beef",
  "pork",
  "chicken",
  "seafood",
  "dairy",
  "egg",
  "milk",
  "cheese",
  "butter",
  "rice",
  "wheat",
  "corn",
  "beans",
  "ink",
  "toner",
  "paper",
  "substrate",
  "vinyl",
  "tarpaulin",
  "canvas",
  "laminate",
];

/**
 * Keywords for "Merchandise Inventory" — used in retail/meat-shop businesses
 * where items are purchased for direct resale.
 */
const MERCHANDISE_KEYWORDS: string[] = [
  "chicken",
  "beef",
  "pork",
  "fish",
  "meat",
  "seafood",
  "bangus",
  "tilapia",
  "tanigue",
  "liempo",
  "baboy",
  "manok",
  "baka",
  "product",
  "item",
  "goods",
  "merchandise",
  "stock",
  "inventory",
  "resale",
  "wholesale",
  "retail",
];

/**
 * Keywords for "Construction Materials".
 */
const CONSTRUCTION_MATERIAL_KEYWORDS: string[] = [
  "cement",
  "concrete",
  "sand",
  "gravel",
  "steel",
  "rebar",
  "lumber",
  "wood",
  "plywood",
  "hollow block",
  "chb",
  "nails",
  "bolts",
  "wire",
  "paint",
  "putty",
  "tile",
  "flooring",
  "roofing",
  "galvanized",
  "pvc",
  "pipe",
  "fitting",
  "insulation",
  "glass",
  "door",
  "window",
  "lock",
  "hinge",
  "screw",
  "adhesive",
  "mortar",
];

// ── Core categorization function ────────────────────────────────────────────

/**
 * Returns the most appropriate expense category for an item given the
 * registered business type.
 *
 * Logic:
 *  1. Apply business-specific primary category rules first
 *  2. Fall back to base keyword map
 *  3. Return "General" if nothing matches
 */
export function categorizeItemForBusiness(
  itemTitle: string,
  businessType?: BusinessType | string | null,
): string {
  const lower = itemTitle.toLowerCase();

  switch (businessType) {
    // ── Food Business ────────────────────────────────────────────────────
    case "Food Business": {
      // Food items → Raw Materials (they are cooked/processed)
      if (RAW_MATERIAL_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Raw Materials";
      }
      break;
    }

    // ── Meat Shop ────────────────────────────────────────────────────────
    case "Meat Shop": {
      // Meat products → Merchandise Inventory (sold directly)
      if (MERCHANDISE_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Merchandise Inventory";
      }
      // Ice, sawdust, hooks etc. are store supplies for a meat shop
      if (
        ["ice", "sawdust", "hook", "tray", "container"].some((kw) =>
          lower.includes(kw),
        )
      ) {
        return "Store Supplies";
      }
      break;
    }

    // ── Printing Services ────────────────────────────────────────────────
    case "Printing Services": {
      if (RAW_MATERIAL_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Raw Materials";
      }
      break;
    }

    // ── Construction ─────────────────────────────────────────────────────
    case "Construction": {
      if (CONSTRUCTION_MATERIAL_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Construction Materials";
      }
      if (
        [
          "labor",
          "worker",
          "contractor",
          "subcontractor",
          "skilled",
          "artisan",
        ].some((kw) => lower.includes(kw))
      ) {
        return "Labor & Subcontracting";
      }
      break;
    }

    // ── Retail ───────────────────────────────────────────────────────────
    case "Retail": {
      // Anything that looks like something sold → Merchandise Inventory
      if (MERCHANDISE_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Merchandise Inventory";
      }
      break;
    }

    default:
      // "Others" — try raw materials first, then merchandise
      if (RAW_MATERIAL_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Raw Materials";
      }
      if (MERCHANDISE_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Merchandise Inventory";
      }
      break;
  }

  // ── Base keyword fallback (shared across all business types) ────────────
  for (const [category, keywords] of Object.entries(BASE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }

  return "General";
}

// ── AI prompt context builder ───────────────────────────────────────────────

/**
 * Returns a business-type-specific instruction block to be injected into
 * Gemini / OCR prompts so the AI assigns correct categories.
 */
export function getBusinessTypePromptContext(
  businessType?: BusinessType | string | null,
): string {
  const categories = getCategoriesForBusinessType(businessType);
  const categoryList = categories.join(", ");

  const baseIntro = `The user's business type is: "${businessType || "General Business"}".
Available categories for this business: ${categoryList}`;

  switch (businessType) {
    case "Food Business":
      return `${baseIntro}

BUSINESS-SPECIFIC CATEGORY RULES:
- Assign "Raw Materials" to: food ingredients (chicken, beef, pork, fish, vegetables, fruits, rice, flour, sugar, salt, oil, eggs, dairy, spices, seasonings, and any item used as input to cook or prepare food).
- Assign "Packaging Materials" to: boxes, bags, containers, cups, lids, straws, wrappers used to pack or serve food.
- Assign "Store Supplies" to: cleaning materials, uniforms, office supplies, disposable gloves, aprons.
- Assign "Utilities" to: electricity, water, gas, internet bills.
- Assign "Equipment" to: stoves, ovens, fryers, refrigerators, blenders, mixers, grills, and kitchen tools.
- Assign "Transportation" to: fuel, delivery, logistics costs.`;

    case "Meat Shop":
      return `${baseIntro}

BUSINESS-SPECIFIC CATEGORY RULES:
- Assign "Merchandise Inventory" to: ALL meat products purchased for resale (chicken, pork, beef, fish, seafood, and any raw meat/poultry). These are sold directly to customers without processing.
- Assign "Store Supplies" to: ice, sawdust, meat hooks, display trays, cleaning supplies, gloves, aprons, and anything used to operate the shop.
- Assign "Packaging Materials" to: plastic bags, wrappers, labels used to package sold items.
- Assign "Utilities" to: electricity (refrigeration), water, internet bills.
- Assign "Equipment" to: meat slicers, freezers, refrigerators, weighing scales, and shop machinery.
- Assign "Transportation" to: fuel, delivery, vehicle-related costs.`;

    case "Printing Services":
      return `${baseIntro}

BUSINESS-SPECIFIC CATEGORY RULES:
- Assign "Raw Materials" to: ink, toner, printing paper, tarpaulin, vinyl, canvas, laminate film, substrate materials—anything consumed during printing.
- Assign "Equipment" to: printers, cutters, laminators, heat presses, binding machines, and maintenance parts.
- Assign "Store Supplies" to: cleaning materials, office supplies, uniforms.
- Assign "Packaging Materials" to: boxes, tubes, protective wrap for finished print products.
- Assign "Utilities" to: electricity, internet, phone bills.
- Assign "Transportation" to: delivery, fuel, logistics.`;

    case "Construction":
      return `${baseIntro}

BUSINESS-SPECIFIC CATEGORY RULES:
- Assign "Construction Materials" to: cement, sand, gravel, steel bars, lumber, plywood, hollow blocks, nails, bolts, paint, tiles, roofing sheets, PVC pipes, wire, adhesives, and any physical materials incorporated into the structure.
- Assign "Labor & Subcontracting" to: wages, labor fees, contractor payments, skilled worker fees.
- Assign "Equipment" to: power tools, heavy machinery, scaffolding, concrete mixers, welding equipment, and equipment rentals.
- Assign "Transportation" to: fuel, hauling, delivery of materials, vehicle rental.
- Assign "Store Supplies" to: safety gear (hardhats, gloves, vests), first-aid supplies, office materials.
- Assign "Utilities" to: temporary electricity, water/site utilities.`;

    case "Retail":
      return `${baseIntro}

BUSINESS-SPECIFIC CATEGORY RULES:
- Assign "Merchandise Inventory" to: ALL items purchased specifically for resale to customers. This is the primary category for a retail business.
- Assign "Store Supplies" to: cleaning materials, hangers, price tags, display fixtures, office supplies.
- Assign "Packaging Materials" to: shopping bags, tissue paper, boxes, protective wrap.
- Assign "Utilities" to: electricity, water, internet, phone bills.
- Assign "Equipment" to: POS machines, display shelves, air conditioning, CCTV, lighting.
- Assign "Transportation" to: delivery, fuel, courier services.`;

    default:
      return `${baseIntro}

CATEGORY ASSIGNMENT RULES:
- "Raw Materials": ingredients, food items, materials used in production or processing.
- "Merchandise Inventory": products purchased for direct resale to customers.
- "Packaging Materials": boxes, bags, containers, labels used for packaging.
- "Store Supplies": cleaning items, office supplies, uniforms, operational supplies.
- "Utilities": electricity, water, internet, phone bills.
- "Equipment": machines, appliances, tools used in operations.
- "Transportation": fuel, delivery, vehicle-related costs.
- "General": anything that doesn't fit the above categories.`;
  }
}

/**
 * Quick helper: returns the primary "inventory/production" category name
 * for the given business type, used when an item clearly belongs to the
 * core business stock/input category.
 */
export function getPrimaryCategory(
  businessType?: BusinessType | string | null,
): string {
  switch (businessType) {
    case "Meat Shop":
    case "Retail":
      return "Merchandise Inventory";
    case "Construction":
      return "Construction Materials";
    default:
      return "Raw Materials";
  }
}
