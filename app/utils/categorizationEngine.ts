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
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
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
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "Ice & Cold Storage",
        "General",
      ];

    case "Printing Services":
      return [
        "Raw Materials",
        "Equipment",
        "Store Supplies",
        "Packaging Materials",
        "Utilities",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Construction":
      return [
        "Construction Materials",
        "Equipment",
        "Labor & Subcontracting",
        "Transportation",
        "Store Supplies",
        "Utilities",
        "Rent",
        "Marketing & Advertising",
        "Permits & Certifications",
        "Insurance",
        "Bank Charges",
        "Tools & Hardware",
        "Safety Equipment",
        "General",
      ];

    case "Retail":
      return [
        "Merchandise Inventory",
        "Store Supplies",
        "Packaging Materials",
        "Utilities",
        "Equipment",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "Security Services",
        "General",
      ];

    case "Water Station":
      return [
        "Water Supplies",
        "Gallon/Container Inventory",
        "Utilities",
        "Equipment",
        "Transportation",
        "Store Supplies",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Laundry Shop":
      return [
        "Detergents & Chemicals",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Packaging Materials",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Internet Cafe":
      return [
        "Internet Services",
        "Computer Equipment",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Packaging Materials",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Software Subscriptions",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Beauty Salon":
      return [
        "Hair & Beauty Products",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Packaging Materials",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Repair Shop":
      return [
        "Parts & Components",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Tools",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Pharmacy":
      return [
        "Medicines & Drugs",
        "Medical Supplies",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Packaging Materials",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Convenience Store":
      return [
        "Merchandise Inventory",
        "Store Supplies",
        "Packaging Materials",
        "Utilities",
        "Equipment",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "Security Services",
        "General",
      ];

    case "Hardware":
      return [
        "Hardware Inventory",
        "Store Supplies",
        "Packaging Materials",
        "Utilities",
        "Equipment",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Computer Shop":
      return [
        "Computer Parts",
        "Accessories",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Packaging Materials",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Software Subscriptions",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Mobile Shop":
      return [
        "Phone & Gadgets",
        "Accessories",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Packaging Materials",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Bakery":
      return [
        "Raw Materials",
        "Packaging Materials",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Coffee Shop":
      return [
        "Raw Materials",
        "Packaging Materials",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    case "Sari-Sari Store":
      return [
        "Merchandise Inventory",
        "Store Supplies",
        "Packaging Materials",
        "Utilities",
        "Equipment",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
        "General",
      ];

    default:
      return [
        "Raw Materials",
        "Merchandise Inventory",
        "Packaging Materials",
        "Store Supplies",
        "Utilities",
        "Equipment",
        "Transportation",
        "Rent",
        "Marketing & Advertising",
        "Employee Wages",
        "Maintenance & Repairs",
        "Licenses & Permits",
        "Insurance",
        "Bank Charges",
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
    "bubble wrap",
    "shrink wrap",
    "envelope",
    "box",
    "sando bag",
    "ziplock",
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
    "trash bag",
    "pail",
    "dustpan",
    "rags",
    "hanger",
    "price tag",
    "sticker label",
  ],
  Utilities: [
    "electricity",
    "electric bill",
    "water",
    "water bill",
    "bill",
    "internet",
    "internet bill",
    "phone",
    "phone bill",
    "cable",
    "wifi",
    "utility",
    "utility bill",
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
    "meralco bill",
    "load",
    "prepaid",
    "postpaid",
  ],
  Equipment: [
    "equipment",
    "machine",
    "device",
    "appliance",
    "refrigerator",
    "fridge",
    "oven",
    "microwave",
    "blender",
    "mixer",
    "fan",
    "aircon",
    "ac",
    "air conditioner",
    "freezer",
    "stove",
    "grill",
    "fryer",
    "cutter",
    "slicer",
    "scale",
    "weighing scale",
    "register",
    "pos",
    "cash register",
    "printer",
    "scanner",
    "computer",
    "laptop",
    "monitor",
    "keyboard",
    "mouse",
    "speaker",
    "tv",
    "television",
    "cctv",
    "camera",
    "generator",
    "inverter",
    "battery",
    "solar panel",
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
    "jeepney",
    "tricycle",
    "motorcycle",
    "parking",
    "toll",
    "toll fee",
    "petron",
    "shell",
    "caltex",
    "phoenix",
    "seaoil",
    "leteo",
    "fare",
    "transpo",
    "transportation",
    "vehicle",
    "motor",
    "car",
    "truck",
    "van",
    "liter",
    "litre",
    "delivery",
    "shipping",
    "courier",
    "logistics",
    " freight",
    "shipping fee",
    "driver",
    "helper",
    "fuel card",
  ],
  Rent: [
    "rent",
    "rental",
    "rental fee",
    "lease",
    "leasehold",
    "monthly rent",
    "space rental",
    "store rental",
    "stall rental",
    "warehouse rental",
    "office rental",
    "landlord",
    "landlady",
    "owner",
    "rental deposit",
    "advance rent",
    "security deposit",
  ],
  "Marketing & Advertising": [
    "marketing",
    "advertising",
    "ads",
    "promotion",
    "promo",
    "flyer",
    "poster",
    "banner",
    "tarpaulin",
    "signage",
    "signboard",
    "neon sign",
    "facebook ads",
    "google ads",
    "instagram ads",
    "social media",
    "marketing campaign",
    "discount",
    "rebate",
    "commission",
    "referral",
    "giveaway",
    "prize",
    "raffle",
    "coupon",
    "voucher",
    "leaflet",
    "brochure",
    "business card",
    "printing",
  ],
  "Employee Wages": [
    "wage",
    "wages",
    "salary",
    "pay",
    "payroll",
    "employee",
    "staff",
    "worker",
    "labor",
    "labor cost",
    "bonus",
    "incentive",
    "overtime",
    "allowance",
    "commission",
    "daily wage",
    "monthly salary",
    "13th month",
    " Separation pay",
    "termination pay",
    "benefits",
    "sss",
    "philhealth",
    "pagibig",
    "government contribution",
    "hiring",
  ],
  "Maintenance & Repairs": [
    "maintenance",
    "repair",
    "repairing",
    "fix",
    "fixing",
    "service",
    "servicing",
    "maintain",
    "troubleshoot",
    "troubleshooting",
    "parts replacement",
    "spare parts",
    "replacement",
    "overhaul",
    "tune-up",
    "cleaning service",
    "pest control",
    "plumbing",
    "electrical repair",
    "aircon service",
    "refrigerator service",
  ],
  "Licenses & Permits": [
    "license",
    "permit",
    "permits",
    "licensing",
    "registration",
    "business permit",
    "mayor permit",
    "barangay permit",
    "dti",
    "sec",
    "bir",
    "tin",
    "certificate",
    "clearance",
    "accreditation",
    "renewal",
    "compliance",
    "legal fee",
    "attorney",
    "lawyer",
    "notary",
    "doc stamp",
    " Documentary stamp",
  ],
  Insurance: [
    "insurance",
    "premium",
    "insurance premium",
    "coverage",
    "policy",
    "health insurance",
    "life insurance",
    "business insurance",
    "property insurance",
    "vehicle insurance",
    "car insurance",
    "microinsurance",
    "marine insurance",
    "claim",
    "insured",
  ],
  "Bank Charges": [
    "bank",
    "banking",
    "bank charge",
    "service charge",
    "fee",
    "charges",
    "maintenance fee",
    "ledger fee",
    "dormancy fee",
    "transfer fee",
    "remittance",
    "wire fee",
    "interest",
    "interest rate",
    "loan",
    "loan payment",
    "credit",
    "credit card",
    "installment",
    "atm fee",
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
  // Bakery specific
  "yeast",
  "baking powder",
  "baking soda",
  "cocoa",
  "chocolate",
  "vanilla",
  "cream",
  "margarine",
  "shortening",
  "bread",
  "pasta",
  "noodle",
  "coffee",
  "tea",
  "cocoa powder",
  "jam",
  "honey",
  "syrup",
  "chocolate syrup",
  // Coffee shop specific
  "espresso",
  "latte",
  "cappuccino",
  "mocha",
  "americano",
  "coffee beans",
  "ground coffee",
  "matcha",
  "strawberry",
  "mango",
  "banana",
  "avocado",
  "milk tea",
  "pearl",
  "tapioca",
  "boba",
  "ice cream",
  "vanilla ice cream",
  "chocolate ice cream",
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
      if (MERCHANDISE_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Merchandise Inventory";
      }
      break;
    }

    // ── Water Station ─────────────────────────────────────────────────
    case "Water Station": {
      if (["water", "distilled", "refill", "gallon", "container", "dispenser"].some(kw => lower.includes(kw))) {
        return "Water Supplies";
      }
      if (MERCHANDISE_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Gallon/Container Inventory";
      }
      break;
    }

    // ── Laundry Shop ──────────────────────────────────────────────────
    case "Laundry Shop": {
      if (["detergent", "bleach", "fabric conditioner", "softener", "soap", "laundry"].some(kw => lower.includes(kw))) {
        return "Detergents & Chemicals";
      }
      break;
    }

    // ── Internet Cafe ───────────────────────────────────────────────────
    case "Internet Cafe": {
      if (["internet", "wifi", "load", "data"].some(kw => lower.includes(kw))) {
        return "Internet Services";
      }
      if (["computer", "pc", "laptop", "cpu", "monitor", "keyboard", "mouse", "headset"].some(kw => lower.includes(kw))) {
        return "Computer Equipment";
      }
      break;
    }

    // ── Beauty Salon ───────────────────────────────────────────────────
    case "Beauty Salon": {
      if (["shampoo", "conditioner", "hair dye", "bleach", "perm", "treatment", "styling", "gel", "wax", "pomade", "hair spray"].some(kw => lower.includes(kw))) {
        return "Hair & Beauty Products";
      }
      break;
    }

    // ── Repair Shop ───────────────────────────────────────────────────
    case "Repair Shop": {
      if (["part", "component", "spare", "replacement", "screen", "battery", "charger", "cable"].some(kw => lower.includes(kw))) {
        return "Parts & Components";
      }
      if (["tool", "solder", "multimeter", "screwdriver", "wrench"].some(kw => lower.includes(kw))) {
        return "Tools";
      }
      break;
    }

    // ── Pharmacy ────────────────────────────────────────────────────────
    case "Pharmacy": {
      if (["medicine", "drug", "tablet", "capsule", "syrup", "prescription", "OTC", "pharma"].some(kw => lower.includes(kw))) {
        return "Medicines & Drugs";
      }
      if (["bandage", "gauze", "cotton", "alcohol", "betadine", "thermometer", "bp monitor"].some(kw => lower.includes(kw))) {
        return "Medical Supplies";
      }
      break;
    }

    // ── Convenience Store ─────────────────────────────────────────────
    case "Convenience Store": {
      if (MERCHANDISE_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Merchandise Inventory";
      }
      break;
    }

    // ── Hardware ──────────────────────────────────────────────────────
    case "Hardware": {
      if (CONSTRUCTION_MATERIAL_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Hardware Inventory";
      }
      if (["tool", "hammer", "saw", "drill", "wrench", "screwdriver", "plier"].some(kw => lower.includes(kw))) {
        return "Hardware Inventory";
      }
      break;
    }

    // ── Computer Shop ───────────────────────────────────────────────────
    case "Computer Shop": {
      if (["cpu", "processor", "motherboard", "ram", "hard disk", "ssd", "gpu", "graphics card", "psu", "case", "fan"].some(kw => lower.includes(kw))) {
        return "Computer Parts";
      }
      if (["mouse", "keyboard", "headset", "webcam", "monitor", "speaker", "cable", "adapter"].some(kw => lower.includes(kw))) {
        return "Accessories";
      }
      break;
    }

    // ── Mobile Shop ───────────────────────────────────────────────────
    case "Mobile Shop": {
      if (["phone", "smartphone", "tablet", "gadget", "iphone", "samsung", "vivo", "oppo", "realme", "xiaomi"].some(kw => lower.includes(kw))) {
        return "Phone & Gadgets";
      }
      if (["case", "charger", "cable", "headset", "earphone", "powerbank", "screen protector"].some(kw => lower.includes(kw))) {
        return "Accessories";
      }
      break;
    }

    // ── Bakery ────────────────────────────────────────────────────────
    case "Bakery": {
      if (RAW_MATERIAL_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Raw Materials";
      }
      break;
    }

    // ── Coffee Shop ───────────────────────────────────────────────────
    case "Coffee Shop": {
      if (RAW_MATERIAL_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "Raw Materials";
      }
      break;
    }

    // ── Sari-Sari Store ────────────────────────────────────────────────
    case "Sari-Sari Store": {
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
Available categories for this business: ${categoryList}

CRITICAL: The SAME item may belong to DIFFERENT categories depending on the business type. Always consider the business context when categorizing.`;

  switch (businessType) {
    case "Food Business":
      return `${baseIntro}

CATEGORY RULES FOR FOOD BUSINESS:
- "Raw Materials" (PRIMARY): ALL food ingredients used to cook/prepare dishes - chicken, beef, pork, fish, seafood, vegetables, fruits, rice, flour, sugar, salt, OIL (cooking oil, palm oil, coconut oil), eggs, dairy, spices, seasonings, sauces, condiments, milk, cheese, butter, margarine, yeast, baking powder, coffee beans, tea leaves, cocoa, chocolate, vanilla, cream, syrup, honey, jam, ice, and ANY food item consumed in food preparation.
- "Packaging Materials": boxes, plastic bags, containers, cups, lids, straws, wrappers, sando bags, ziplock bags, foil, cling wrap, tissue, napkins, styrofoam containers.
- "Store Supplies": cleaning supplies (detergent, soap, bleach, disinfectant, sanitizer, mop, broom, brush, sponge, trash bags), uniforms, aprons, gloves, towels, office supplies (pen, paper, calculator), price tags, stickers.
- "Equipment": stoves, ovens, fryers, refrigerators, freezers, blenders, mixers, grinders, grills, microwaves, air fryers, rice cookers, pressure cookers, weighing scales, food processors, exhaust fans, kitchen utensils.
- "Utilities": electricity, water, gas (LPG), internet, phone bills.
- "Transportation": fuel, gasoline, diesel, delivery fees, courier, shipping costs, driver/helper wages.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Oil" (cooking oil, palm oil, coconut oil) → "Raw Materials" (consumed in cooking)
- "Chicken" → "Raw Materials" (used to cook meals)
- "Rice" → "Raw Materials" (used as ingredient)
- "Plastic bag" → "Packaging Materials"
- "Detergent" → "Store Supplies" (for cleaning)`;

    case "Meat Shop":
      return `${baseIntro}

CATEGORY RULES FOR MEAT SHOP:
- "Merchandise Inventory" (PRIMARY): ALL meat products purchased for resale - chicken (whole, cut-up, parts), pork (liempo, pigue, baryete, pork belly), beef, goat meat, fish (bangus, tilapia, tanigue, galunggong, maya-maya, pusit, hipon, alimango), seafood, seafood, poultry, and ANY raw meat or seafood sold directly to customers without further processing.
- "Store Supplies": ice (for display/preservation), sawdust, meat hooks, display trays, plastic trays, styrofoam trays, cutting boards, cleaning supplies (detergent, bleach, disinfectant), gloves, aprons, uniforms, weighing bags.
- "Packaging Materials": plastic bags, shopper bags, wrapper, cling wrap, labels, stickers, price tags.
- "Equipment": meat slicers, meat grinders, freezers, refrigerators, weighing scales (digital, manual), display cabinets, ice chest/coolers, knives, sharpening stones.
- "Ice & Cold Storage": ice blocks, crushed ice, ice delivery.
- "Utilities": electricity (refrigeration is critical), water, internet, phone.
- "Transportation": fuel, delivery van, ice delivery.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Chicken" → "Merchandise Inventory" (sold as-is, not cooked)
- "Pork" → "Merchandise Inventory" (sold as-is)
- "Fish" → "Merchandise Inventory" (sold fresh)
- "Ice" → "Ice & Cold Storage" (critical for preservation)
- "Sawdust" → "Store Supplies" (for display)
- "Weighing scale" → "Equipment"`;

    case "Printing Services":
      return `${baseIntro}

CATEGORY RULES FOR PRINTING SERVICES:
- "Raw Materials" (PRIMARY): ink (all types), toner, printing paper (A4, A3, letter, legal, tabloid), tarpaulin, vinyl, canvas, substrates, laminate film (cold lamination, hot lamination), adhesive, cutting mat, print film, proofing paper, cardboard, bond paper, thermal paper, sticker paper, magnetic sheet, foam board.
- "Equipment": printers (laser, inkjet, large format), cutters, laminators, heat presses, binding machines (spiral, thermal, perfect), trimmers, guillotines, scanners, computers, monitors, routers.
- "Store Supplies": cleaning supplies, office supplies, uniforms, gloves, aprons.
- "Packaging Materials": boxes, tubes, protective wrap, bubble wrap, cardboard boxes, mailing envelopes.
- "Utilities": electricity, internet, phone bills.
- "Transportation": delivery fees, fuel, courier services.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Ink" → "Raw Materials" (consumed in printing)
- "Toner" → "Raw Materials" (consumed)
- "Paper A4" → "Raw Materials" (consumed)
- "Tarpaulin" → "Raw Materials" (used in printing jobs)
- "Printer" → "Equipment"
- "Laminator" → "Equipment"`;

    case "Construction":
      return `${baseIntro}

CATEGORY RULES FOR CONSTRUCTION BUSINESS:
- "Construction Materials" (PRIMARY): cement, sand, gravel, steel bars (rebar), lumber, plywood, hollow blocks (CHB), nails, bolts, nuts, screws, wire, mesh, chicken wire, barb wire, paint (all types), primer, thinner, putty, tile, flooring, roofing (GI sheets, roofing nails), PVC pipes, pvc fittings, copper pipes, galvanized pipes, elbow, tee, valve, adhesive (epoxy, silicone, construction glue), mortar, grout, concrete mix, gravel, base course,Fillers, insulation, glass panes, doors (wooden, steel, PVC), windows, locks, hinges, handles, door closer, sealant, caulk, waterproofing.
- "Labor & Subcontracting": wages for workers, laborer's fees, contractor payments, skilled worker fees (carpenter, mason, electrician, plumber), subcontractor fees, foreman salary.
- "Tools & Hardware": hand tools (hammer, saw, screwdriver, wrench, pliers, crowbar, chisel), power tools (drill, grinder, circular saw, jackhammer), measuring tools (tape measure, level, square), tool box.
- "Safety Equipment": hard hat, safety helmet, safety vest, safety shoes, gloves (work gloves), goggles, ear plugs, face shield, first aid kit, fire extinguisher, safety harness.
- "Equipment": heavy machinery (excavator, bulldozer, crane, concrete mixer), scaffolding, formwork, ladders, wheelbarrow, construction equipment rentals.
- "Transportation": fuel, hauling fees, material delivery, truck rental, equipment transport.
- "Permits & Certifications": building permits, electrical permits, plumbing permits, business license, BIR registration.
- "Utilities": temporary electricity, water connection, site utilities.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Cement" → "Construction Materials"
- "Sand" → "Construction Materials"
- "Labor" → "Labor & Subcontracting"
- "Hard hat" → "Safety Equipment"
- "Drill" → "Tools & Hardware"
- "Generator" → "Equipment"`;

    case "Retail":
      return `${baseIntro}

CATEGORY RULES FOR RETAIL BUSINESS:
- "Merchandise Inventory" (PRIMARY): ALL products purchased for resale to customers - clothing, shoes, accessories, electronics, household items, toys, books, cosmetics, toiletries, food items, beverages, and ANY goods sold directly to customers.
- "Store Supplies": hangers, display racks, mannequins, price tags, stickers, labels, shopping bags (if custom printed), display fixtures, shelving, cleaning supplies, uniforms, aprons, gloves.
- "Packaging Materials": plastic bags, paper bags, boxes, gift wrap, tissue paper, ribbon, bubble wrap, foam.
- "Equipment": POS system, cash register, barcode scanner, weighing scale, CCTV cameras, air conditioning units, refrigerators (if selling perishables), display shelves, lighting fixtures.
- "Security Services": security guard, CCTV monitoring, alarm system.
- "Utilities": electricity, water, internet, phone, security services.
- "Transportation": delivery fees, fuel, courier, shipping.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- Any product bought for resale → "Merchandise Inventory"
- "Shopping bag" → "Packaging Materials"
- "Hanger" → "Store Supplies"
- "POS machine" → "Equipment"`;

    case "Water Station":
      return `${baseIntro}

CATEGORY RULES FOR WATER STATION BUSINESS:
- "Water Supplies" (PRIMARY): distilled water, purified water, mineral water, refill water, water refilling supplies, water treatment chemicals (chlorine, filtration media), water containers, gallon caps, seals.
- "Gallon/Container Inventory": empty gallons (19L), refilled gallons, water containers for sale/rent.
- "Equipment": water filtration system, RO machine, UV sterilizer, water dispenser, water pump, storage tanks, piping, fittings, valves.
- "Store Supplies": cleaning supplies, uniforms, gloves, aprons, office supplies.
- "Packaging Materials": gallon labels, stickers, shrink wrap, boxes.
- "Utilities": electricity (for filtration/pumping), water (source), internet.
- "Transportation": fuel, delivery van, cylinder/courier.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Distilled water" → "Water Supplies"
- "Empty gallon" → "Gallon/Container Inventory"
- "RO filter" → "Equipment"
- "Chlorine" → "Water Supplies"`;

    case "Laundry Shop":
      return `${baseIntro}

CATEGORY RULES FOR LAUNDRY SHOP BUSINESS:
- "Detergents & Chemicals" (PRIMARY): detergent (powder, liquid), bleach, fabric softener, fabric conditioner, stain remover, laundry soap, soap flakes, washing soda, baking soda, vinegar, laundry perfume, scent boosters, starch (for ironing), dry cleaning chemicals, spot remover.
- "Equipment": washing machines (industrial, commercial), dryers, ironing stations, steam iron, folding table, laundry cart, laundry basket, weighing scale.
- "Store Supplies": hangers (for hanging finished clothes), plastic covers, laundry bags, tags, markers, cleaning supplies (for shop floor), uniforms, aprons, gloves.
- "Packaging Materials": plastic bags, garment bags, boxes, tissue paper.
- "Utilities": electricity (machines), water, internet.
- "Transportation": delivery vehicle, fuel.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Detergent" → "Detergents & Chemicals"
- "Bleach" → "Detergents & Chemicals"
- "Fabric softener" → "Detergents & Chemicals"
- "Washing machine" → "Equipment"
- "Iron" → "Equipment"
- "Plastic bag" → "Packaging Materials"`;

    case "Internet Cafe":
      return `${baseIntro}

CATEGORY RULES FOR INTERNET CAFE BUSINESS:
- "Internet Services" (PRIMARY): internet subscription, WiFi router, data plan, bandwidth, ISP billing, network maintenance, domain hosting.
- "Computer Equipment" (PRIMARY): desktop computers, laptops, CPUs, monitors, keyboards, mice, headsets, webcams, speakers, computer tables, chairs, network cables, router, switch, modem, UPS (uninterruptible power supply), ethernet cables.
- "Software Subscriptions": gaming software, operating system licenses, Microsoft Office, antivirus, anti-malware, subscription fees.
- "Store Supplies": cleaning supplies (for computer cleaning), disinfecting wipes, earphone covers, mouse pads, desk mats, uniforms, office supplies.
- "Equipment": air conditioning, CCTV, security cameras, CCTV monitor.
- "Packaging Materials": cups (for drinks), straws, napkins.
- "Utilities": electricity, water, internet, phone.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Internet bill" → "Internet Services"
- "CPU" → "Computer Equipment"
- "Monitor" → "Computer Equipment"
- "Headset" → "Computer Equipment"
- "WiFi router" → "Internet Services"
- "Antivirus" → "Software Subscriptions"`;

    case "Beauty Salon":
      return `${baseIntro}

CATEGORY RULES FOR BEAUTY SALON BUSINESS:
- "Hair & Beauty Products" (PRIMARY): shampoo, conditioner, hair treatment, hair mask, hair oil, hair serum, hair spray, hair gel, hair wax, hair mousse, hair dye, hair bleach, hair developer, perm solution, rebonding solution, hair straightening, curling solution, hair color, highlights, toner, conditioner, leave-in treatment, hair vitamins, scalp treatment, beauty products (facials, skin care), cosmetics, makeup, lipstick, foundation, powder, blush, eye shadow, eyeliner, mascara, nail polish, nail polish remover, acetone, artificial nails, nail glue, pedicure/manicure tools, beauty salon supplies.
- "Equipment": hair dryer, curling iron, flat iron, hair straightener, shampoo chair, styling chair, mirror, nail dryer, UV lamp, facial machine, steamer, waxing pot, extraction tools, scissors, combs, brushes.
- "Store Supplies": towels, capes, smocks, gloves, aprons, cleaning supplies, disinfectants, sanitizers, tissue, cotton, cotton buds, makeup remover.
- "Packaging Materials": plastic bags, wraps, boxes.
- "Utilities": electricity, water, internet.
- "Transportation": delivery, fuel.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Shampoo" → "Hair & Beauty Products"
- "Hair dye" → "Hair & Beauty Products"
- "Nail polish" → "Hair & Beauty Products"
- "Hair dryer" → "Equipment"
- "Scissors" → "Equipment"
- "Towel" → "Store Supplies"`;

    case "Repair Shop":
      return `${baseIntro}

CATEGORY RULES FOR REPAIR SHOP BUSINESS:
- "Parts & Components" (PRIMARY): replacement parts, spare parts, components, screens (phone, tablet, laptop), batteries, chargers, cables (USB, lightning, charging), flex cables, connectors, IC chips, resistors, capacitors, transistors, diodes, LED, sensors, motors, switches, buttons, SIM tray, memory card, speaker, microphone, earpiece, vibrator, antenna, frame, housing, back cover, bezel, lens, touch panel, display panel.
- "Tools" (PRIMARY): screwdrivers (Phillips, flathead, Torx), pliers, tweezers, spudger, suction cup, heat gun, soldering iron, solder wire, flux, multimeter, oscilloscope, power supply, magnifying glass, loupe, vice grip, wrench set, knife, cutter, scalpel, precision tools.
- "Store Supplies": cleaning supplies (IPA alcohol, cleaning solution), cleaning brushes, lint-free cloth, thermal paste, thermal pad, adhesive (glue, tape), silicone, kapton tape, cable ties, ziplock bags, packaging, uniforms, gloves.
- "Equipment": soldering station, rework station, hot air station, microscope, inspection lamp, workbench, storage cabinet.
- "Utilities": electricity, water, internet.
- "Transportation": delivery, fuel.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Screen" → "Parts & Components" (replacement screen)
- "Battery" → "Parts & Components"
- "Screwdriver" → "Tools"
- "Soldering iron" → "Tools"
- "Thermal paste" → "Store Supplies"
- "IPA alcohol" → "Store Supplies"`;

    case "Pharmacy":
      return `${baseIntro}

CATEGORY RULES FOR PHARMACY BUSINESS:
- "Medicines & Drugs" (PRIMARY): all medicines (prescription, OTC), antibiotics, analgesics (paracetamol, ibuprofen, mefenamic), vitamins, supplements, syrups, tablets, capsules, injectables, IV fluids, pediatric medicines, adult medicines, herbal medicines, homeopathic, vaccines, birth control pills, condoms, pregnancy test kits, diabetic medicines, hypertension medicines, maintenance medicines.
- "Medical Supplies" (PRIMARY): bandages, gauze, cotton, alcohol (70% isopropyl), betadine, hydrogen peroxide, antiseptic solution, thermometer, BP monitor, blood glucose meter, test strips, lancets, syringes (with/without needle), gloves (medical), face mask, face shield, PPE, surgical tape, cotton buds, cotton balls, wound care, first aid supplies.
- "Store Supplies": shopping bags, labels, price tags, stickers, cleaning supplies, uniforms, aprons.
- "Packaging Materials": medicine bottles, blister packs, boxes, pill organizers, shrink wrap.
- "Equipment": refrigerator (for medicines), weighing scale, BP apparatus, nebulizer, pulse oximeter.
- "Utilities": electricity (refrigeration important), water, internet.
- "Transportation": cold chain delivery, fuel, courier.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Paracetamol" → "Medicines & Drugs"
- "Vitamin B" → "Medicines & Drugs"
- "Bandage" → "Medical Supplies"
- "Alcohol" → "Medical Supplies"
- "Thermometer" → "Medical Supplies"
- "Medicine refrigerator" → "Equipment"`;

    case "Convenience Store":
      return `${baseIntro}

CATEGORY RULES FOR CONVENIENCE STORE BUSINESS:
- "Merchandise Inventory" (PRIMARY): ALL products sold - snacks (chips, crackers, biscuits, chocolates, candies, gum), beverages (softdrinks, water, juice, coffee, tea, milk, alcohol), instant noodles, canned goods, processed foods, grocery items, personal care products (shampoo, soap, toothpaste), household items, cigarettes, lottery tickets.
- "Store Supplies": shelves, display racks, price tags, stickers, labels, shopping bags, cleaning supplies, uniforms, aprons, gloves.
- "Packaging Materials": plastic bags, paper bags, containers, wrappers, foil.
- "Equipment": POS system, cash register, refrigerator (for beverages), freezer, microwave, CCTV, air conditioning.
- "Security Services": security guard, alarm system, CCTV monitoring.
- "Utilities": electricity, water, internet.
- "Transportation": delivery, fuel, courier.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- Any product for resale → "Merchandise Inventory"
- "Plastic bag" → "Packaging Materials"
- "Price tag" → "Store Supplies"
- "POS machine" → "Equipment"`;

    case "Hardware":
      return `${baseIntro}

CATEGORY RULES FOR HARDWARE BUSINESS:
- "Hardware Inventory" (PRIMARY): ALL hardware products sold - nails, screws, bolts, nuts, washers, hinges, locks, door handles, cabinet handles, brackets, anchors, cables, wires, pvc pipes, pvc fittings, pipes, valves, electrical switches, electrical outlets, light bulbs, fluorescent lamps, LED lights, extension cords, power strips, circuit breakers, fuse, junction box, conduit, plywood, wood, lumber, cement, sand, gravel, hollow blocks, paint, brushes, rollers, thinner, putty, tools (hammer, saw, drill, screwdriver, wrench, pliers), measuring tools, safety equipment.
- "Store Supplies": shopping bags, price tags, stickers, labels, cleaning supplies, uniforms, aprons.
- "Packaging Materials": plastic bags, boxes, shrink wrap.
- "Equipment": cutting tools (saw, cutter), drilling machine, grinder.
- "Utilities": electricity, water, internet.
- "Transportation": delivery, fuel.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- Any hardware product sold → "Hardware Inventory"
- "Nail" → "Hardware Inventory"
- "Paint" → "Hardware Inventory"
- "Hammer" → "Hardware Inventory"
- "PVC pipe" → "Hardware Inventory"`;

    case "Computer Shop":
      return `${baseIntro}

CATEGORY RULES FOR COMPUTER SHOP BUSINESS:
- "Computer Parts" (PRIMARY): CPU (processor), motherboard, RAM (DDR4, DDR5), hard disk drive (HDD), solid state drive (SSD), graphics card (GPU), power supply unit (PSU), computer case, CPU cooler, fan, thermal paste, heatsink, optical drive, sound card, network card, wifi adapter.
- "Accessories" (PRIMARY): mouse, keyboard, monitor, headset, speakers, webcam, microphone, USB hub, cable (USB, HDMI, VGA, ethernet, power), adapter, converter, power strip, UPS, stabilizer, mouse pad, laptop stand, phone stand, stylus.
- "Store Supplies": cleaning supplies (compressed air, cleaning kit, alcohol wipes), anti-static wristband, anti-static mat, cable ties, zip ties, packaging, uniforms.
- "Packaging Materials": boxes, foam, bubble wrap, anti-static bags.
- "Equipment": soldering station, test bench, diagnostic tools.
- "Software Subscriptions": operating system, antivirus, Microsoft Office, gaming software.
- "Utilities": electricity, internet.
- "Transportation": delivery, fuel.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "RAM" → "Computer Parts"
- "Graphics card" → "Computer Parts"
- "Mouse" → "Accessories"
- "Keyboard" → "Accessories"
- "HDMI cable" → "Accessories"
- "Anti-static wristband" → "Store Supplies"`;

    case "Mobile Shop":
      return `${baseIntro}

CATEGORY RULES FOR MOBILE SHOP BUSINESS:
- "Phone & Gadgets" (PRIMARY): smartphones, mobile phones, tablets, iPhones, Samsung, Vivo, Oppo, Realme, Xiaomi, Tecno, Infinix, Nokia, old/used phones, tablets, smartwatches, fitness trackers.
- "Accessories" (PRIMARY): phone cases, chargers, charging cables, adapters, powerbanks, earphones, headphones, bluetooth speakers, screen protectors, tempered glass, phone holders, car mounts, selfie sticks, phone straps, OTG flash drives, memory cards, SIM ejector tool, repair tools.
- "Store Supplies": cleaning supplies, display stands, price tags, stickers, packaging, uniforms.
- "Packaging Materials": boxes, plastic bags, bubble wrap.
- "Equipment": repair tools, soldering station, test equipment.
- "Utilities": electricity, internet.
- "Transportation": delivery, fuel.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "iPhone" → "Phone & Gadgets"
- "Phone case" → "Accessories"
- "Charger" → "Accessories"
- "Powerbank" → "Accessories"
- "Screen protector" → "Accessories"
- "Display stand" → "Store Supplies"`;

    case "Bakery":
      return `${baseIntro}

CATEGORY RULES FOR BAKERY BUSINESS:
- "Raw Materials" (PRIMARY): flour, sugar, salt, baking powder, baking soda, yeast, eggs, milk, butter, margarine, shortening, vegetable oil, cooking oil, coconut oil, vanilla, cocoa powder, chocolate, chocolate chips, honey, syrup, jam, fillings (ube, mango, cheese, pandan), nuts (almond, peanut, walnut), raisins, cheese (all types), fresh fruits, vegetables (for savory items), meat (for meat pies), hotdog, bacon, sausage, pizza toppings, coffee beans, coffee powder, tea leaves, matcha, food coloring, emulsifier, dough conditioner, bread crumbs, panko, cornstarch, cream of tartar.
- "Packaging Materials": bread bags, plastic bags, boxes, cake boxes, cupcake liners, tissue paper, napkins, cling wrap, foil, stickers, labels.
- "Store Supplies": cleaning supplies, uniforms, aprons, gloves, piping bags, nozzles, baking cups, silicone molds, parchment paper.
- "Equipment": oven (gas, electric), mixer (stand mixer, hand mixer), blender, proofing box, refrigerator, freezer, baking pans, trays, cooling rack, dough divider, slicer.
- "Utilities": electricity, gas, water, internet.
- "Transportation": delivery, fuel.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Flour" → "Raw Materials"
- "Yeast" → "Raw Materials"
- "Butter" → "Raw Materials"
- "Bread box" → "Packaging Materials"
- "Mixer" → "Equipment"
- "Piping bag" → "Store Supplies"`;

    case "Coffee Shop":
      return `${baseIntro}

CATEGORY RULES FOR COFFEE SHOP BUSINESS:
- "Raw Materials" (PRIMARY): coffee beans (arabica, robusta, blend), ground coffee, espresso, instant coffee, tea leaves (black tea, green tea, matcha), milk (fresh, evaporated, condensed), creamer, sugar, syrups (caramel, vanilla, hazelnut, chocolate), chocolate powder, cocoa powder, matcha powder, honey, ice, bubble/tapioca pearls, boba, popping boba, crystal boba, coconut jelly, grass jelly, lychee, strawberry, mango, banana, avocado, mint leaves, cinnamon, nutmeg, vanilla pods, whipped cream, ice cream, flavorings, toppings, cinnamon powder, chili flakes, salt (for rim), cups, lids, straws.
- "Packaging Materials": coffee cups, paper cups, plastic cups, lids, straws, sleeve, carrier tray, takeaway bags, food containers.
- "Store Supplies": cleaning supplies, uniforms, aprons, gloves, napkins, tissues, stirrers, sugar packets, creamer packets, coasters.
- "Equipment": espresso machine, coffee brewer, coffee grinder, blender, shaker, milk frother, ice blender, refrigerator, freezer, airpot, coffee dispenser, water filter.
- "Utilities": electricity, water, internet.
- "Transportation": delivery, fuel.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Coffee beans" → "Raw Materials"
- "Milk" → "Raw Materials"
- "Sugar syrup" → "Raw Materials"
- "Tapioca pearls" → "Raw Materials"
- "Paper cup" → "Packaging Materials"
- "Espresso machine" → "Equipment"`;

    case "Sari-Sari Store":
      return `${baseIntro}

CATEGORY RULES FOR SARI-SARI STORE BUSINESS:
- "Merchandise Inventory" (PRIMARY): ALL products sold - rice, sugar, salt, soy sauce, vinegar, cooking oil, canned goods, noodles, biscuits, chocolates, candies, chips, crackers, soap, shampoo, toothpaste, toothbrush, mosquito coil, candles, cigarettes, beverages, bottled water, softdrinks, juice, milk, coffee, tea, laundry soap, detergent, bleach, floor cleaner, insect spray, batteries, light bulbs, candles, matches, school supplies, toys, and ANY consumer goods sold.
- "Store Supplies": shelves, display racks, price tags, stickers, labels, plastic bags, shopping bags, cleaning supplies, uniforms.
- "Packaging Materials": plastic bags, wrappers, cling wrap, foil.
- "Equipment": weighing scale, calculator, refrigerator (if selling cold items), freezer.
- "Utilities": electricity, water, internet.
- "Transportation": delivery, sari-sari supplies restocking.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- Any product for resale → "Merchandise Inventory"
- "Rice" → "Merchandise Inventory"
- "Soap" → "Merchandise Inventory"
- "Plastic bag" → "Store Supplies"
- "Weighing scale" → "Equipment"`;

    default:
      return `${baseIntro}

CATEGORY ASSIGNMENT RULES:
- "Raw Materials": ingredients, food items, materials used in production or processing - flour, sugar, oil, meat, fish, vegetables, fruits, spices, seasonings, eggs, dairy, coffee, tea, ink, toner, paper.
- "Merchandise Inventory": products purchased for direct resale to customers without processing.
- "Packaging Materials": boxes, bags, containers, cups, lids, straws, wrappers, labels used for packaging.
- "Store Supplies": cleaning items, office supplies, uniforms, gloves, aprons, towels, hangers.
- "Utilities": electricity, water, internet, phone bills.
- "Equipment": machines, appliances, tools used in operations - refrigerators, printers, scales, POS machines.
- "Transportation": fuel, delivery, vehicle-related costs.
- "General": anything that doesn't fit the above categories.

CONTEXT REMINDER: The SAME item can belong to DIFFERENT categories depending on business type!
- Oil in Food Business → Raw Materials (used in cooking)
- Oil in Hardware Store → Hardware Inventory (sold as product)
- Oil in Laundry Shop → Detergents & Chemicals (used for washing)
- Chicken in Food Business → Raw Materials (cooked into dishes)
- Chicken in Meat Shop → Merchandise Inventory (sold as-is)
- Paper in Printing Services → Raw Materials (consumed in printing)
- Paper in Office Supply Store → Merchandise Inventory (sold as product)`;
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
