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
