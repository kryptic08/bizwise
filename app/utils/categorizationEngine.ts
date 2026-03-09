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
        "General",
      ];

    case "Printing Business":
    case "Printing Services": // legacy alias
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
        "General",
      ];

    case "Sari-sari Store":
    case "Sari-Sari Store": // legacy alias
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
        "General",
      ];

    // Legacy types — kept so old accounts still categorize correctly
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
        "Ice & Cold Storage",
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
        "Security Services",
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
  General: [
    "misc",
    "miscellaneous",
    "misc fee",
    "miscellaneous fee",
    "other",
    "others",
    "sundry",
    "various",
  ],
};

/**
 * Keywords for "Raw Materials" in FOOD businesses — ingredients used in cooking/production
 */
const FOOD_RAW_MATERIAL_KEYWORDS: string[] = [
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
 * Keywords for "Raw Materials" in PRINTING businesses — supplies used in printing
 */
const PRINTING_RAW_MATERIAL_KEYWORDS: string[] = [
  "raw",
  "material",
  "ink",
  "toner",
  "paper",
  "substrate",
  "vinyl",
  "tarpaulin",
  "canvas",
  "laminate",
  "bond paper",
  "photo paper",
  "sticker paper",
  "cardboard",
  "cartridge",
  "ribbon",
  "coating",
  "varnish",
  "adhesive",
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

// ── Word Boundary Matching Helper ───────────────────────────────────────────

/**
 * Checks if a keyword exists as a whole word in the text.
 * Prevents false matches like "car" in "carrot" or "rice" in "price".
 * Uses word boundaries to match complete words only.
 */
function containsWholeWord(text: string, keyword: string): boolean {
  // Escape special regex characters in the keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match as whole word with word boundaries
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}

/**
 * Checks if any keyword from an array exists as a whole word in the text.
 */
function containsAnyWholeWord(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => containsWholeWord(text, kw));
}

// ── Product Name Database ────────────────────────────────────────────────────
//
// Maps common Filipino product names / brand fragments to the correct category
// for each business type.  Checked FIRST before keyword scanning.
// Keys are lowercase substrings; the lookup is case-insensitive contains().

const PRODUCT_NAME_DATABASE: Record<string, Record<string, string>> = {
  "Food Business": {
    // Cooking oils & fats
    "cooking oil": "Raw Materials",
    "palm oil": "Raw Materials",
    "coconut oil": "Raw Materials",
    "vegetable oil": "Raw Materials",
    mantika: "Raw Materials",
    minola: "Raw Materials",
    "golden fiesta": "Raw Materials",
    "baguio oil": "Raw Materials",
    lard: "Raw Materials",
    margarine: "Raw Materials",
    butter: "Raw Materials",
    // Condiments & seasonings
    "datu puti": "Raw Materials",
    "silver swan": "Raw Materials",
    ufc: "Raw Materials",
    "papa ketchup": "Raw Materials",
    hunts: "Raw Materials",
    "del monte": "Raw Materials",
    "mama sita": "Raw Materials",
    knorr: "Raw Materials",
    maggi: "Raw Materials",
    ajinomoto: "Raw Materials",
    royco: "Raw Materials",
    "mang tomas": "Raw Materials",
    jufran: "Raw Materials",
    "master sauce": "Raw Materials",
    "sukang paombong": "Raw Materials",
    patis: "Raw Materials",
    toyo: "Raw Materials",
    suka: "Raw Materials",
    bagoong: "Raw Materials",
    alamang: "Raw Materials",
    tabasco: "Raw Materials",
    "oyster sauce": "Raw Materials",
    hoisin: "Raw Materials",
    "sesame oil": "Raw Materials",
    vinegar: "Raw Materials",
    "soy sauce": "Raw Materials",
    // Grains & staples
    sinandomeng: "Raw Materials",
    milagrosa: "Raw Materials",
    dinorado: "Raw Materials",
    "jasmine rice": "Raw Materials",
    "lucky me": "Raw Materials",
    "payless noodles": "Raw Materials",
    "lucky me pancit canton": "Raw Materials",
    quickchow: "Raw Materials",
    nissin: "Raw Materials",
    "indo mie": "Raw Materials",
    "instant noodles": "Raw Materials",
    vermicelli: "Raw Materials",
    sotanghon: "Raw Materials",
    bihon: "Raw Materials",
    cornstarch: "Raw Materials",
    "cassava flour": "Raw Materials",
    camote: "Raw Materials",
    gabi: "Raw Materials",
    // Dairy & eggs
    "alaska milk": "Raw Materials",
    "bear brand": "Raw Materials",
    nestle: "Raw Materials",
    carnation: "Raw Materials",
    purefoods: "Raw Materials",
    "fresh egg": "Raw Materials",
    itlog: "Raw Materials",
    "magnolia butter": "Raw Materials",
    keso: "Raw Materials",
    "cream cheese": "Raw Materials",
    quickmelt: "Raw Materials",
    "magnolia cheese": "Raw Materials",
    // Bakery ingredients
    yeast: "Raw Materials",
    "baking powder": "Raw Materials",
    "baking soda": "Raw Materials",
    "bread flour": "Raw Materials",
    "cake flour": "Raw Materials",
    "all purpose flour": "Raw Materials",
    "all-purpose flour": "Raw Materials",
    "white king": "Raw Materials",
    "maya flour": "Raw Materials",
    "magnolia flour": "Raw Materials",
    "vanilla extract": "Raw Materials",
    "food color": "Raw Materials",
    "food coloring": "Raw Materials",
    "cocoa powder": "Raw Materials",
    "dark chocolate": "Raw Materials",
    "compound chocolate": "Raw Materials",
    fondant: "Raw Materials",
    "cream of tartar": "Raw Materials",
    "ube flavor": "Raw Materials",
    "pandan extract": "Raw Materials",
    // Sweeteners
    "washed sugar": "Raw Materials",
    "refined sugar": "Raw Materials",
    "brown sugar": "Raw Materials",
    muscovado: "Raw Materials",
    honey: "Raw Materials",
    "corn syrup": "Raw Materials",
    stevia: "Raw Materials",
    // Packaging common brands
    "glad wrap": "Packaging Materials",
    "saran wrap": "Packaging Materials",
    "cling wrap": "Packaging Materials",
    "styrofoam container": "Packaging Materials",
    "mami bowl": "Packaging Materials",
    "paper cup": "Packaging Materials",
    "hot cup": "Packaging Materials",
    "cold cup": "Packaging Materials",
    "sando bag": "Packaging Materials",
    "trash bag": "Store Supplies",
    "garbage bag": "Store Supplies",
    // Store supplies brands
    "surf detergent": "Store Supplies",
    ariel: "Store Supplies",
    tide: "Store Supplies",
    domex: "Store Supplies",
    lysol: "Store Supplies",
    zonrox: "Store Supplies",
    "Mr clean": "Store Supplies",
    "joy dishwashing": "Store Supplies",
    axion: "Store Supplies",
    "champion detergent": "Store Supplies",
    // Utilities
    meralco: "Utilities",
    maynilad: "Utilities",
    "manila water": "Utilities",
    converge: "Utilities",
    "globe broadband": "Utilities",
    pldt: "Utilities",
    "sky broadband": "Utilities",
    cignal: "Utilities",
    "smart broadband": "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    "internet bill": "Utilities",
    "gas bill": "Utilities",
    // Fuel & transportation
    petron: "Transportation",
    "shell gasoline": "Transportation",
    caltex: "Transportation",
    "phoenix fuel": "Transportation",
    seaoil: "Transportation",
    "total energies": "Transportation",
    "grab delivery": "Transportation",
    lalamove: "Transportation",
    "jrs express": "Transportation",
    lbc: "Transportation",
    "2go": "Transportation",
    "j&t": "Transportation",
    "flash express": "Transportation",
    // LPG
    lpg: "Utilities",
    gasul: "Utilities",
    shellane: "Utilities",
    "primus gas": "Utilities",
    solane: "Utilities",
    "caltex gas": "Utilities",
  },

  "Meat Shop": {
    // Primary inventory — all meat is for resale
    "chicken breast": "Merchandise Inventory",
    "chicken leg": "Merchandise Inventory",
    "chicken thigh": "Merchandise Inventory",
    "chicken wings": "Merchandise Inventory",
    "whole chicken": "Merchandise Inventory",
    "dressed chicken": "Merchandise Inventory",
    manok: "Merchandise Inventory",
    "pork belly": "Merchandise Inventory",
    liempo: "Merchandise Inventory",
    "pork ribs": "Merchandise Inventory",
    baryete: "Merchandise Inventory",
    kasim: "Merchandise Inventory",
    pigue: "Merchandise Inventory",
    "pork shoulder": "Merchandise Inventory",
    baboy: "Merchandise Inventory",
    "beef brisket": "Merchandise Inventory",
    "beef shank": "Merchandise Inventory",
    bulalo: "Merchandise Inventory",
    baka: "Merchandise Inventory",
    bangus: "Merchandise Inventory",
    tilapia: "Merchandise Inventory",
    galunggong: "Merchandise Inventory",
    tanigue: "Merchandise Inventory",
    "maya-maya": "Merchandise Inventory",
    "lapu-lapu": "Merchandise Inventory",
    hipon: "Merchandise Inventory",
    pusit: "Merchandise Inventory",
    alimango: "Merchandise Inventory",
    alimasag: "Merchandise Inventory",
    talaba: "Merchandise Inventory",
    tahong: "Merchandise Inventory",
    lamb: "Merchandise Inventory",
    kambing: "Merchandise Inventory",
    "goat meat": "Merchandise Inventory",
    "pork chop": "Merchandise Inventory",
    "ground pork": "Merchandise Inventory",
    "ground beef": "Merchandise Inventory",
    hotdog: "Merchandise Inventory",
    longganisa: "Merchandise Inventory",
    tocino: "Merchandise Inventory",
    tapa: "Merchandise Inventory",
    chorizo: "Merchandise Inventory",
    // Cold chain supplies
    "ice block": "Ice & Cold Storage",
    "crushed ice": "Ice & Cold Storage",
    "dry ice": "Ice & Cold Storage",
    "ice delivery": "Ice & Cold Storage",
    "block ice": "Ice & Cold Storage",
    "tubig na yelo": "Ice & Cold Storage",
    // Store supplies
    sawdust: "Store Supplies",
    "meat hook": "Store Supplies",
    "meat tray": "Store Supplies",
    styrotray: "Store Supplies",
    "chopping board": "Store Supplies",
    "cutting board": "Store Supplies",
    "butcher paper": "Packaging Materials",
    "stretch wrap": "Packaging Materials",
    "cling film": "Packaging Materials",
    "sando bag": "Packaging Materials",
    "weighing scale": "Equipment",
    freezer: "Equipment",
    "chest freezer": "Equipment",
    "display chiller": "Equipment",
    "meat slicer": "Equipment",
    "meat grinder": "Equipment",
    "band saw": "Equipment",
    "boning knife": "Store Supplies",
    cleaver: "Store Supplies",
    "knife sharpener": "Store Supplies",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    petron: "Transportation",
    "shell gasoline": "Transportation",
    caltex: "Transportation",
    "grab delivery": "Transportation",
    lalamove: "Transportation",
  },

  "Printing Services": {
    // Inks & consumables
    "epson ink": "Raw Materials",
    "canon ink": "Raw Materials",
    "hp ink": "Raw Materials",
    "brother ink": "Raw Materials",
    "pigment ink": "Raw Materials",
    "dye ink": "Raw Materials",
    "sublimation ink": "Raw Materials",
    "eco solvent ink": "Raw Materials",
    "uv ink": "Raw Materials",
    "dtf ink": "Raw Materials",
    "flex ink": "Raw Materials",
    "latex ink": "Raw Materials",
    "hp latex": "Raw Materials",
    "mimaki ink": "Raw Materials",
    "roland ink": "Raw Materials",
    toner: "Raw Materials",
    "drum unit": "Raw Materials",
    "imaging unit": "Raw Materials",
    // Substrates
    "bond paper": "Raw Materials",
    "a4 paper": "Raw Materials",
    "a3 paper": "Raw Materials",
    "legal paper": "Raw Materials",
    "short bond": "Raw Materials",
    "long bond": "Raw Materials",
    "glossy paper": "Raw Materials",
    "matte paper": "Raw Materials",
    "photo paper": "Raw Materials",
    "sticker paper": "Raw Materials",
    "vinyl sticker": "Raw Materials",
    tarpaulin: "Raw Materials",
    tarp: "Raw Materials",
    canvas: "Raw Materials",
    "backlit film": "Raw Materials",
    frontlit: "Raw Materials",
    "mesh banner": "Raw Materials",
    "one-way vision": "Raw Materials",
    "fridge magnet": "Raw Materials",
    "magnetic sheet": "Raw Materials",
    "foam board": "Raw Materials",
    "sintra board": "Raw Materials",
    corflute: "Raw Materials",
    "corrugated board": "Raw Materials",
    "cold laminate": "Raw Materials",
    "hot laminate": "Raw Materials",
    "laminating film": "Raw Materials",
    "laminating pouch": "Raw Materials",
    "dtf film": "Raw Materials",
    "transfer paper": "Raw Materials",
    "heat transfer": "Raw Materials",
    "sublimation paper": "Raw Materials",
    "carbon paper": "Raw Materials",
    "ncr paper": "Raw Materials",
    "thermal paper": "Raw Materials",
    // Printers & equipment
    "epson printer": "Equipment",
    "canon printer": "Equipment",
    "hp printer": "Equipment",
    "large format printer": "Equipment",
    "wide format printer": "Equipment",
    "roland printer": "Equipment",
    "mimaki printer": "Equipment",
    "mutoh printer": "Equipment",
    "dtf printer": "Equipment",
    "uv printer": "Equipment",
    "laser printer": "Equipment",
    laminator: "Equipment",
    "laminating machine": "Equipment",
    "heat press": "Equipment",
    "cutter plotter": "Equipment",
    "vinyl cutter": "Equipment",
    guillotine: "Equipment",
    "paper cutter": "Equipment",
    "binding machine": "Equipment",
    "spiral binder": "Equipment",
    "booklet maker": "Equipment",
    scanner: "Equipment",
    "rip software": "Equipment",
    // Utilities
    meralco: "Utilities",
    "electric bill": "Utilities",
    "internet bill": "Utilities",
    pldt: "Utilities",
    converge: "Utilities",
    petron: "Transportation",
    lalamove: "Transportation",
    "grab delivery": "Transportation",
    lbc: "Transportation",
  },

  Construction: {
    // Materials
    "portland cement": "Construction Materials",
    "sahara cement": "Construction Materials",
    holcim: "Construction Materials",
    "union cement": "Construction Materials",
    "republic cement": "Construction Materials",
    "premium cement": "Construction Materials",
    "fine sand": "Construction Materials",
    "coarse sand": "Construction Materials",
    screening: "Construction Materials",
    "crushed gravel": "Construction Materials",
    "base course": "Construction Materials",
    "pea gravel": "Construction Materials",
    "hollow block": "Construction Materials",
    chb: "Construction Materials",
    "concrete hollow block": "Construction Materials",
    rebar: "Construction Materials",
    "deformed bar": "Construction Materials",
    "gi wire": "Construction Materials",
    "tie wire": "Construction Materials",
    plywood: "Construction Materials",
    "marine plywood": "Construction Materials",
    "ordinary plywood": "Construction Materials",
    lumber: "Construction Materials",
    "coco lumber": "Construction Materials",
    "2x3": "Construction Materials",
    "2x4": "Construction Materials",
    "4x4 post": "Construction Materials",
    "gi sheet": "Construction Materials",
    "roofing sheet": "Construction Materials",
    "pre-painted": "Construction Materials",
    corrugated: "Construction Materials",
    "ridge roll": "Construction Materials",
    "fascia board": "Construction Materials",
    "pvc pipe": "Construction Materials",
    "upvc pipe": "Construction Materials",
    "gi pipe": "Construction Materials",
    "copper pipe": "Construction Materials",
    elbow: "Construction Materials",
    "tee fitting": "Construction Materials",
    "ball valve": "Construction Materials",
    "gate valve": "Construction Materials",
    "wire nut": "Construction Materials",
    "romex wire": "Construction Materials",
    "thhn wire": "Construction Materials",
    "circuit breaker": "Construction Materials",
    "electrical panel": "Construction Materials",
    "junction box": "Construction Materials",
    "conduit pipe": "Construction Materials",
    "flex conduit": "Construction Materials",
    "floor tile": "Construction Materials",
    "wall tile": "Construction Materials",
    "ceramic tile": "Construction Materials",
    "granite tile": "Construction Materials",
    "marble tile": "Construction Materials",
    "vinyl floor": "Construction Materials",
    paint: "Construction Materials",
    primer: "Construction Materials",
    putty: "Construction Materials",
    skimcoat: "Construction Materials",
    davies: "Construction Materials",
    boysen: "Construction Materials",
    "nippon paint": "Construction Materials",
    "dutch boy": "Construction Materials",
    thinner: "Construction Materials",
    "epoxy primer": "Construction Materials",
    elastomeric: "Construction Materials",
    waterproofing: "Construction Materials",
    sealant: "Construction Materials",
    caulk: "Construction Materials",
    silicone: "Construction Materials",
    door: "Construction Materials",
    window: "Construction Materials",
    jalousie: "Construction Materials",
    "aluminum door": "Construction Materials",
    "steel door": "Construction Materials",
    hinges: "Construction Materials",
    "door lock": "Construction Materials",
    "door knob": "Construction Materials",
    "sliding door": "Construction Materials",
    nails: "Construction Materials",
    tekscrew: "Construction Materials",
    "bolt and nut": "Construction Materials",
    "anchor bolt": "Construction Materials",
    grout: "Construction Materials",
    "tile adhesive": "Construction Materials",
    "mortar mix": "Construction Materials",
    araldite: "Construction Materials",
    "construction glue": "Construction Materials",
    // Tools
    hammer: "Tools & Hardware",
    "claw hammer": "Tools & Hardware",
    "dead blow": "Tools & Hardware",
    sledgehammer: "Tools & Hardware",
    handsaw: "Tools & Hardware",
    "circular saw": "Tools & Hardware",
    jigsaw: "Tools & Hardware",
    "reciprocating saw": "Tools & Hardware",
    "angle grinder": "Tools & Hardware",
    "electric drill": "Tools & Hardware",
    "impact driver": "Tools & Hardware",
    "rotary hammer": "Tools & Hardware",
    level: "Tools & Hardware",
    "spirit level": "Tools & Hardware",
    "tape measure": "Tools & Hardware",
    "try square": "Tools & Hardware",
    "plumb bob": "Tools & Hardware",
    trowel: "Tools & Hardware",
    "paint roller": "Tools & Hardware",
    "paint brush": "Tools & Hardware",
    float: "Tools & Hardware",
    shovel: "Tools & Hardware",
    "pick axe": "Tools & Hardware",
    hoe: "Tools & Hardware",
    wheelbarrow: "Tools & Hardware",
    ladder: "Tools & Hardware",
    "steel bar cutter": "Tools & Hardware",
    "bar bender": "Tools & Hardware",
    scaffold: "Equipment",
    scaffolding: "Equipment",
    // Safety
    "hard hat": "Safety Equipment",
    "safety helmet": "Safety Equipment",
    "safety vest": "Safety Equipment",
    "safety harness": "Safety Equipment",
    "safety net": "Safety Equipment",
    "safety shoes": "Safety Equipment",
    "work boots": "Safety Equipment",
    "work gloves": "Safety Equipment",
    "safety goggles": "Safety Equipment",
    "dust mask": "Safety Equipment",
    respirator: "Safety Equipment",
    "ear plugs": "Safety Equipment",
    "first aid kit": "Safety Equipment",
    "fire extinguisher": "Safety Equipment",
    // Labor
    laborer: "Labor & Subcontracting",
    mason: "Labor & Subcontracting",
    carpenter: "Labor & Subcontracting",
    electrician: "Labor & Subcontracting",
    plumber: "Labor & Subcontracting",
    welder: "Labor & Subcontracting",
    "painter fee": "Labor & Subcontracting",
    foreman: "Labor & Subcontracting",
    subcontractor: "Labor & Subcontracting",
    "contractor fee": "Labor & Subcontracting",
    "skilled worker": "Labor & Subcontracting",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    petron: "Transportation",
    "shell gasoline": "Transportation",
    caltex: "Transportation",
    lalamove: "Transportation",
    trucking: "Transportation",
    hauling: "Transportation",
  },

  Retail: {
    merchandise: "Merchandise Inventory",
    "product stock": "Merchandise Inventory",
    "for resale": "Merchandise Inventory",
    "shopping bag": "Packaging Materials",
    "paper bag": "Packaging Materials",
    "gift wrap": "Packaging Materials",
    ribbon: "Packaging Materials",
    hanger: "Store Supplies",
    "display rack": "Store Supplies",
    "price tag": "Store Supplies",
    "barcode sticker": "Store Supplies",
    "pos machine": "Equipment",
    "cash register": "Equipment",
    "barcode scanner": "Equipment",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "internet bill": "Utilities",
    "security guard": "Security Services",
    "alarm system": "Security Services",
    cctv: "Equipment",
    petron: "Transportation",
    lalamove: "Transportation",
    "grab delivery": "Transportation",
    lbc: "Transportation",
    "j&t": "Transportation",
    "flash express": "Transportation",
  },

  "Water Station": {
    "distilled water": "Water Supplies",
    "purified water": "Water Supplies",
    "mineral water": "Water Supplies",
    "refill water": "Water Supplies",
    "water treatment": "Water Supplies",
    "chlorine tablet": "Water Supplies",
    "chlorine solution": "Water Supplies",
    "filtration media": "Water Supplies",
    "activated carbon": "Water Supplies",
    "sand filter": "Water Supplies",
    "sediment filter": "Water Supplies",
    "filter cartridge": "Water Supplies",
    "ro membrane": "Water Supplies",
    "uv lamp": "Water Supplies",
    "gallon cap": "Water Supplies",
    "bottle seal": "Water Supplies",
    "jug seal": "Water Supplies",
    "empty gallon": "Gallon/Container Inventory",
    "19 liter": "Gallon/Container Inventory",
    "5 gallon": "Gallon/Container Inventory",
    "water jug": "Gallon/Container Inventory",
    "water container": "Gallon/Container Inventory",
    "ro machine": "Equipment",
    "reverse osmosis": "Equipment",
    "water pump": "Equipment",
    "storage tank": "Equipment",
    "water dispenser": "Equipment",
    "filtration system": "Equipment",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    petron: "Transportation",
    "grab delivery": "Transportation",
    lalamove: "Transportation",
  },

  "Laundry Shop": {
    "ariel detergent": "Detergents & Chemicals",
    "surf detergent": "Detergents & Chemicals",
    "tide detergent": "Detergents & Chemicals",
    "champion detergent": "Detergents & Chemicals",
    "breeze detergent": "Detergents & Chemicals",
    "perla soap": "Detergents & Chemicals",
    "detergent powder": "Detergents & Chemicals",
    "detergent liquid": "Detergents & Chemicals",
    "laundry soap": "Detergents & Chemicals",
    "zonrox bleach": "Detergents & Chemicals",
    "chlorine bleach": "Detergents & Chemicals",
    "color-safe bleach": "Detergents & Chemicals",
    downy: "Detergents & Chemicals",
    "comfort fabric": "Detergents & Chemicals",
    "fabric softener": "Detergents & Chemicals",
    "fabric conditioner": "Detergents & Chemicals",
    "stain remover": "Detergents & Chemicals",
    vanish: "Detergents & Chemicals",
    "mr muscle": "Detergents & Chemicals",
    "washing soda": "Detergents & Chemicals",
    "baking soda": "Detergents & Chemicals",
    "laundry perfume": "Detergents & Chemicals",
    "scent booster": "Detergents & Chemicals",
    hagalao: "Detergents & Chemicals",
    "sta. rosa starch": "Detergents & Chemicals",
    "laundry starch": "Detergents & Chemicals",
    "dry cleaning solvent": "Detergents & Chemicals",
    "spot remover": "Detergents & Chemicals",
    "industrial washing machine": "Equipment",
    "commercial dryer": "Equipment",
    "steam iron": "Equipment",
    "steam press": "Equipment",
    "ironing board": "Equipment",
    "laundry trolley": "Equipment",
    "laundry cart": "Equipment",
    "weighing scale": "Equipment",
    hanger: "Store Supplies",
    "laundry bag": "Packaging Materials",
    "garment bag": "Packaging Materials",
    "plastic cover": "Packaging Materials",
    "tag pin": "Store Supplies",
    "laundry tag": "Store Supplies",
    "marker permanent": "Store Supplies",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    "grab delivery": "Transportation",
    lalamove: "Transportation",
  },

  "Internet Cafe": {
    "internet subscription": "Internet Services",
    "wifi subscription": "Internet Services",
    "broadband plan": "Internet Services",
    converge: "Internet Services",
    "pldt fiber": "Internet Services",
    "globe fiber": "Internet Services",
    "sky broadband": "Internet Services",
    "smart bro": "Internet Services",
    "sun broadband": "Internet Services",
    "static ip": "Internet Services",
    "data plan": "Internet Services",
    bandwidth: "Internet Services",
    "desktop computer": "Computer Equipment",
    "computer unit": "Computer Equipment",
    "gaming pc": "Computer Equipment",
    "all-in-one pc": "Computer Equipment",
    "cpu set": "Computer Equipment",
    monitor: "Computer Equipment",
    keyboard: "Computer Equipment",
    mouse: "Computer Equipment",
    "gaming mouse": "Computer Equipment",
    "gaming keyboard": "Computer Equipment",
    headset: "Computer Equipment",
    "gaming headset": "Computer Equipment",
    webcam: "Computer Equipment",
    router: "Computer Equipment",
    "network switch": "Computer Equipment",
    "cisco switch": "Computer Equipment",
    "tp-link": "Computer Equipment",
    modem: "Computer Equipment",
    "ethernet cable": "Computer Equipment",
    "cat6 cable": "Computer Equipment",
    "ups battery": "Computer Equipment",
    "apc ups": "Computer Equipment",
    "antivirus license": "Software Subscriptions",
    "windows license": "Software Subscriptions",
    "microsoft office": "Software Subscriptions",
    kaspersky: "Software Subscriptions",
    "steam wallet": "Software Subscriptions",
    "gaming account": "Software Subscriptions",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    "aircon service": "Maintenance & Repairs",
  },

  "Beauty Salon": {
    shampoo: "Hair & Beauty Products",
    conditioner: "Hair & Beauty Products",
    "hair mask": "Hair & Beauty Products",
    "keratin treatment": "Hair & Beauty Products",
    "hair treatment": "Hair & Beauty Products",
    "hair serum": "Hair & Beauty Products",
    "hair oil": "Hair & Beauty Products",
    "argan oil": "Hair & Beauty Products",
    "moroccan oil": "Hair & Beauty Products",
    "hair spray": "Hair & Beauty Products",
    "hair gel": "Hair & Beauty Products",
    "hair wax": "Hair & Beauty Products",
    pomade: "Hair & Beauty Products",
    "hair mousse": "Hair & Beauty Products",
    "hair dye": "Hair & Beauty Products",
    "hair color": "Hair & Beauty Products",
    loreal: "Hair & Beauty Products",
    wella: "Hair & Beauty Products",
    schwarzkopf: "Hair & Beauty Products",
    majirel: "Hair & Beauty Products",
    koleston: "Hair & Beauty Products",
    igora: "Hair & Beauty Products",
    "bleaching powder": "Hair & Beauty Products",
    "ox developer": "Hair & Beauty Products",
    "perming solution": "Hair & Beauty Products",
    "rebonding solution": "Hair & Beauty Products",
    neutralizer: "Hair & Beauty Products",
    toner: "Hair & Beauty Products",
    gloss: "Hair & Beauty Products",
    "highlights kit": "Hair & Beauty Products",
    "nail polish": "Hair & Beauty Products",
    opi: "Hair & Beauty Products",
    essie: "Hair & Beauty Products",
    "nail gel": "Hair & Beauty Products",
    "nail primer": "Hair & Beauty Products",
    "nail glue": "Hair & Beauty Products",
    "nail tips": "Hair & Beauty Products",
    "acrylic powder": "Hair & Beauty Products",
    "acrylic liquid": "Hair & Beauty Products",
    "gel base coat": "Hair & Beauty Products",
    "gel top coat": "Hair & Beauty Products",
    "nail polish remover": "Hair & Beauty Products",
    acetone: "Hair & Beauty Products",
    "waxing strips": "Hair & Beauty Products",
    "wax beans": "Hair & Beauty Products",
    "facial cream": "Hair & Beauty Products",
    "face mask": "Hair & Beauty Products",
    "toner facial": "Hair & Beauty Products",
    moisturizer: "Hair & Beauty Products",
    "serum facial": "Hair & Beauty Products",
    "hair dryer": "Equipment",
    "blow dryer": "Equipment",
    "flat iron": "Equipment",
    "curling iron": "Equipment",
    "curling wand": "Equipment",
    "hot roller": "Equipment",
    "hair straightener": "Equipment",
    "salon chair": "Equipment",
    "shampoo bowl": "Equipment",
    "shampoo chair": "Equipment",
    "styling mirror": "Equipment",
    "uv lamp nail": "Equipment",
    "led lamp nail": "Equipment",
    "nail drill": "Equipment",
    "facial steamer": "Equipment",
    "facial machine": "Equipment",
    "waxing heater": "Equipment",
    "wax warmer": "Equipment",
    towel: "Store Supplies",
    "salon cape": "Store Supplies",
    "neck strip": "Store Supplies",
    "foil sheet": "Store Supplies",
    "mixing bowl": "Store Supplies",
    "color brush": "Store Supplies",
    "tail comb": "Store Supplies",
    "wide tooth comb": "Store Supplies",
    "rat tail comb": "Store Supplies",
    "salon scissors": "Equipment",
    "thinning scissors": "Equipment",
    clippers: "Equipment",
    trimmer: "Equipment",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
  },

  "Repair Shop": {
    // Phone/device parts
    "iphone screen": "Parts & Components",
    "samsung screen": "Parts & Components",
    "lcd screen": "Parts & Components",
    "oled display": "Parts & Components",
    digitizer: "Parts & Components",
    "touch screen": "Parts & Components",
    "phone battery": "Parts & Components",
    "laptop battery": "Parts & Components",
    "power bank": "Parts & Components",
    "charging port": "Parts & Components",
    "usb port": "Parts & Components",
    "lightning port": "Parts & Components",
    "flex cable": "Parts & Components",
    "ribbon cable": "Parts & Components",
    "back cover": "Parts & Components",
    "back glass": "Parts & Components",
    "phone frame": "Parts & Components",
    "middle frame": "Parts & Components",
    motherboard: "Parts & Components",
    "logic board": "Parts & Components",
    "ic chip": "Parts & Components",
    capacitor: "Parts & Components",
    resistor: "Parts & Components",
    diode: "Parts & Components",
    transistor: "Parts & Components",
    mosfet: "Parts & Components",
    "sim tray": "Parts & Components",
    "sim card slot": "Parts & Components",
    "memory card slot": "Parts & Components",
    "speaker mesh": "Parts & Components",
    earpiece: "Parts & Components",
    microphone: "Parts & Components",
    "vibrator motor": "Parts & Components",
    "camera lens": "Parts & Components",
    "front camera": "Parts & Components",
    "rear camera": "Parts & Components",
    "fingerprint sensor": "Parts & Components",
    "face id": "Parts & Components",
    "power button": "Parts & Components",
    "volume button": "Parts & Components",
    "home button": "Parts & Components",
    // Laptop parts
    "laptop screen": "Parts & Components",
    "laptop keyboard": "Parts & Components",
    "laptop fan": "Parts & Components",
    "laptop charger": "Parts & Components",
    "ram memory": "Parts & Components",
    "hard drive replacement": "Parts & Components",
    "ssd replacement": "Parts & Components",
    // Tools
    "pentalobe screwdriver": "Tools",
    "torx screwdriver": "Tools",
    "philip screwdriver": "Tools",
    "precision screwdriver set": "Tools",
    spudger: "Tools",
    "pry tool": "Tools",
    "suction cup": "Tools",
    "anti-static tweezers": "Tools",
    "soldering iron": "Tools",
    "solder wire": "Tools",
    "soldering flux": "Tools",
    "solder paste": "Tools",
    "hot air rework": "Tools",
    "heat gun": "Tools",
    multimeter: "Tools",
    oscilloscope: "Tools",
    "dc power supply": "Tools",
    "magnifying glass": "Tools",
    microscope: "Equipment",
    "trinocular microscope": "Equipment",
    "isopropyl alcohol": "Store Supplies",
    "ipa 70%": "Store Supplies",
    "ipa 99%": "Store Supplies",
    "cleaning solution": "Store Supplies",
    "thermal paste": "Store Supplies",
    "arctic silver": "Store Supplies",
    "thermal pad": "Store Supplies",
    "kapton tape": "Store Supplies",
    "double sided tape": "Store Supplies",
    "oca glue": "Store Supplies",
    "loca glue": "Store Supplies",
    "b7000 glue": "Store Supplies",
    "t7000 glue": "Store Supplies",
    "uv glue": "Store Supplies",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "internet bill": "Utilities",
  },

  Pharmacy: {
    // OTC medicines
    paracetamol: "Medicines & Drugs",
    ibuprofen: "Medicines & Drugs",
    "mefenamic acid": "Medicines & Drugs",
    aspirin: "Medicines & Drugs",
    biogesic: "Medicines & Drugs",
    tempra: "Medicines & Drugs",
    alaxan: "Medicines & Drugs",
    medicol: "Medicines & Drugs",
    ponstan: "Medicines & Drugs",
    dolfenal: "Medicines & Drugs",
    solmux: "Medicines & Drugs",
    ascof: "Medicines & Drugs",
    bisolvon: "Medicines & Drugs",
    dimetapp: "Medicines & Drugs",
    decolgen: "Medicines & Drugs",
    neozep: "Medicines & Drugs",
    tuseran: "Medicines & Drugs",
    robitussin: "Medicines & Drugs",
    lagundi: "Medicines & Drugs",
    sambong: "Medicines & Drugs",
    pansemide: "Medicines & Drugs",
    losartan: "Medicines & Drugs",
    amlodipine: "Medicines & Drugs",
    atorvastatin: "Medicines & Drugs",
    metformin: "Medicines & Drugs",
    omeprazole: "Medicines & Drugs",
    amoxicillin: "Medicines & Drugs",
    azithromycin: "Medicines & Drugs",
    cetirizine: "Medicines & Drugs",
    loratadine: "Medicines & Drugs",
    "vitamin c": "Medicines & Drugs",
    "vitamin b complex": "Medicines & Drugs",
    "vitamin d": "Medicines & Drugs",
    zinc: "Medicines & Drugs",
    "iron supplement": "Medicines & Drugs",
    "calcium supplement": "Medicines & Drugs",
    "ascorbic acid": "Medicines & Drugs",
    berocca: "Medicines & Drugs",
    enervon: "Medicines & Drugs",
    stresstabs: "Medicines & Drugs",
    "myra e": "Medicines & Drugs",
    condoms: "Medicines & Drugs",
    "pregnancy test": "Medicines & Drugs",
    // Medical supplies
    "gauze pad": "Medical Supplies",
    "surgical gauze": "Medical Supplies",
    bandage: "Medical Supplies",
    "elastic bandage": "Medical Supplies",
    "cotton balls": "Medical Supplies",
    "cotton buds": "Medical Supplies",
    "isopropyl alcohol": "Medical Supplies",
    "ethyl alcohol": "Medical Supplies",
    betadine: "Medical Supplies",
    "povidone iodine": "Medical Supplies",
    "hydrogen peroxide": "Medical Supplies",
    "wound dressing": "Medical Supplies",
    "wound closure": "Medical Supplies",
    "medical tape": "Medical Supplies",
    "surgical tape": "Medical Supplies",
    bandaid: "Medical Supplies",
    "band-aid": "Medical Supplies",
    "digital thermometer": "Medical Supplies",
    "bp apparatus": "Medical Supplies",
    "blood pressure monitor": "Medical Supplies",
    "omron bp": "Medical Supplies",
    glucometer: "Medical Supplies",
    "blood glucose meter": "Medical Supplies",
    lancet: "Medical Supplies",
    "test strip": "Medical Supplies",
    syringe: "Medical Supplies",
    "insulin syringe": "Medical Supplies",
    "iv catheter": "Medical Supplies",
    "iv set": "Medical Supplies",
    "face mask medical": "Medical Supplies",
    "surgical gloves": "Medical Supplies",
    "disposable gloves": "Medical Supplies",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    "medicine refrigerator": "Equipment",
    "pharmacy refrigerator": "Equipment",
  },

  "Convenience Store": {
    "for resale": "Merchandise Inventory",
    chippy: "Merchandise Inventory",
    nova: "Merchandise Inventory",
    piattos: "Merchandise Inventory",
    oishi: "Merchandise Inventory",
    "jack n jill": "Merchandise Inventory",
    "clover chips": "Merchandise Inventory",
    "chiz curl": "Merchandise Inventory",
    "v-cut": "Merchandise Inventory",
    rebisco: "Merchandise Inventory",
    hansel: "Merchandise Inventory",
    fita: "Merchandise Inventory",
    skyflakes: "Merchandise Inventory",
    "monde biscuits": "Merchandise Inventory",
    "coca cola": "Merchandise Inventory",
    pepsi: "Merchandise Inventory",
    royal: "Merchandise Inventory",
    sprite: "Merchandise Inventory",
    "mountain dew": "Merchandise Inventory",
    "c2 green tea": "Merchandise Inventory",
    gulaman: "Merchandise Inventory",
    "nature spring": "Merchandise Inventory",
    "absolute water": "Merchandise Inventory",
    "wilkins water": "Merchandise Inventory",
    "red bull": "Merchandise Inventory",
    "sting energy": "Merchandise Inventory",
    marlboro: "Merchandise Inventory",
    "philip morris": "Merchandise Inventory",
    "fortune cigarette": "Merchandise Inventory",
    "hope cigarette": "Merchandise Inventory",
    "mighty cigarette": "Merchandise Inventory",
    "lucky strike": "Merchandise Inventory",
    "winston cigarette": "Merchandise Inventory",
    milo: "Merchandise Inventory",
    nescafe: "Merchandise Inventory",
    kopiko: "Merchandise Inventory",
    "great taste coffee": "Merchandise Inventory",
    "san mig coffee": "Merchandise Inventory",
    "knorr sinigang mix": "Merchandise Inventory",
    "mama sita": "Merchandise Inventory",
    "lucky me": "Merchandise Inventory",
    payless: "Merchandise Inventory",
    "nissin cup noodles": "Merchandise Inventory",
    "century tuna": "Merchandise Inventory",
    "mega sardines": "Merchandise Inventory",
    "argentina sardines": "Merchandise Inventory",
    "birch tree milk": "Merchandise Inventory",
    "bear brand milk": "Merchandise Inventory",
    "milo powder": "Merchandise Inventory",
    "palmolive shampoo": "Merchandise Inventory",
    "head and shoulders": "Merchandise Inventory",
    pantene: "Merchandise Inventory",
    "safeguard soap": "Merchandise Inventory",
    "dove soap": "Merchandise Inventory",
    colgate: "Merchandise Inventory",
    sensodyne: "Merchandise Inventory",
    "close up": "Merchandise Inventory",
    "shopping bag": "Packaging Materials",
    "plastic bag": "Packaging Materials",
    "pos machine": "Equipment",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "internet bill": "Utilities",
    "security guard": "Security Services",
    petron: "Transportation",
    lalamove: "Transportation",
  },

  Hardware: {
    "portland cement": "Hardware Inventory",
    "holcim cement": "Hardware Inventory",
    "pvc pipe": "Hardware Inventory",
    "gi pipe": "Hardware Inventory",
    "copper wire": "Hardware Inventory",
    "thhn wire": "Hardware Inventory",
    "romex wire": "Hardware Inventory",
    "circuit breaker": "Hardware Inventory",
    "fluorescent lamp": "Hardware Inventory",
    "led bulb": "Hardware Inventory",
    "cfl bulb": "Hardware Inventory",
    "extension cord": "Hardware Inventory",
    "power strip": "Hardware Inventory",
    "electrical outlet": "Hardware Inventory",
    "light switch": "Hardware Inventory",
    plywood: "Hardware Inventory",
    "marine plywood": "Hardware Inventory",
    lumber: "Hardware Inventory",
    "coco lumber": "Hardware Inventory",
    "hollow block": "Hardware Inventory",
    rebar: "Hardware Inventory",
    "gi sheet": "Hardware Inventory",
    "roofing sheet": "Hardware Inventory",
    "boysen paint": "Hardware Inventory",
    "davies paint": "Hardware Inventory",
    "nippon paint": "Hardware Inventory",
    "dutch boy paint": "Hardware Inventory",
    "white latex": "Hardware Inventory",
    "enamel paint": "Hardware Inventory",
    "wood stain": "Hardware Inventory",
    "primer paint": "Hardware Inventory",
    "paint roller": "Hardware Inventory",
    "paint brush": "Hardware Inventory",
    "roller tray": "Hardware Inventory",
    "masking tape": "Hardware Inventory",
    sandpaper: "Hardware Inventory",
    nails: "Hardware Inventory",
    "concrete nails": "Hardware Inventory",
    "common nails": "Hardware Inventory",
    "roofing nails": "Hardware Inventory",
    tekscrew: "Hardware Inventory",
    "self-tapping screw": "Hardware Inventory",
    "anchor bolt": "Hardware Inventory",
    "toggle bolt": "Hardware Inventory",
    "ball valve": "Hardware Inventory",
    "gate valve": "Hardware Inventory",
    "float valve": "Hardware Inventory",
    "solvent cement": "Hardware Inventory",
    "pvc elbow": "Hardware Inventory",
    "pvc tee": "Hardware Inventory",
    hammer: "Hardware Inventory",
    handsaw: "Hardware Inventory",
    "hand drill": "Hardware Inventory",
    level: "Hardware Inventory",
    "tape measure": "Hardware Inventory",
    trowel: "Hardware Inventory",
    "floor tile": "Hardware Inventory",
    "wall tile": "Hardware Inventory",
    "tile adhesive": "Hardware Inventory",
    grout: "Hardware Inventory",
    waterproofing: "Hardware Inventory",
    "door knob": "Hardware Inventory",
    padlock: "Hardware Inventory",
    hinges: "Hardware Inventory",
    "shopping bag": "Packaging Materials",
    meralco: "Utilities",
    "electric bill": "Utilities",
    petron: "Transportation",
    lalamove: "Transportation",
  },

  "Computer Shop": {
    "intel core": "Computer Parts",
    "amd ryzen": "Computer Parts",
    "core i3": "Computer Parts",
    "core i5": "Computer Parts",
    "core i7": "Computer Parts",
    "core i9": "Computer Parts",
    "ryzen 3": "Computer Parts",
    "ryzen 5": "Computer Parts",
    "ryzen 7": "Computer Parts",
    "xeon processor": "Computer Parts",
    "asus motherboard": "Computer Parts",
    "msi motherboard": "Computer Parts",
    "gigabyte motherboard": "Computer Parts",
    "asrock motherboard": "Computer Parts",
    "ddr4 ram": "Computer Parts",
    "ddr5 ram": "Computer Parts",
    "kingston ram": "Computer Parts",
    "corsair ram": "Computer Parts",
    "crucial ram": "Computer Parts",
    "g.skill ram": "Computer Parts",
    "teamgroup ram": "Computer Parts",
    "seagate hdd": "Computer Parts",
    "western digital hdd": "Computer Parts",
    "wd blue": "Computer Parts",
    "wd black": "Computer Parts",
    "samsung ssd": "Computer Parts",
    "crucial ssd": "Computer Parts",
    "kingston ssd": "Computer Parts",
    "nvme ssd": "Computer Parts",
    "m.2 ssd": "Computer Parts",
    "rtx 3060": "Computer Parts",
    "rtx 3070": "Computer Parts",
    "rtx 3080": "Computer Parts",
    "rtx 4060": "Computer Parts",
    "rtx 4070": "Computer Parts",
    "gtx 1660": "Computer Parts",
    "rx 6600": "Computer Parts",
    "rx 6700": "Computer Parts",
    gpu: "Computer Parts",
    "graphics card": "Computer Parts",
    "corsair psu": "Computer Parts",
    "seasonic psu": "Computer Parts",
    "fsp psu": "Computer Parts",
    "thermaltake psu": "Computer Parts",
    "power supply": "Computer Parts",
    "nzxt case": "Computer Parts",
    "deepcool case": "Computer Parts",
    "corsair case": "Computer Parts",
    "computer case": "Computer Parts",
    "cpu cooler": "Computer Parts",
    "air cooler": "Computer Parts",
    "liquid cooler": "Computer Parts",
    "case fan": "Computer Parts",
    "logitech mouse": "Accessories",
    "razer mouse": "Accessories",
    "corsair mouse": "Accessories",
    "steelseries mouse": "Accessories",
    "gaming mouse": "Accessories",
    "mechanical keyboard": "Accessories",
    "logitech keyboard": "Accessories",
    "razer keyboard": "Accessories",
    "corsair keyboard": "Accessories",
    "gaming headset": "Accessories",
    "hyperx headset": "Accessories",
    "logitech headset": "Accessories",
    "razer headset": "Accessories",
    "monitor 24": "Accessories",
    "monitor 27": "Accessories",
    "gaming monitor": "Accessories",
    "ips monitor": "Accessories",
    "usb hub": "Accessories",
    "hdmi cable": "Accessories",
    "displayport cable": "Accessories",
    "usb cable": "Accessories",
    "vga cable": "Accessories",
    "ups apc": "Accessories",
    "apc back-ups": "Accessories",
    "power strip": "Accessories",
    "mouse pad": "Accessories",
    "gaming mousepad": "Accessories",
    "rgb set": "Accessories",
    "antivirus kaspersky": "Software Subscriptions",
    "windows 11": "Software Subscriptions",
    "microsoft 365": "Software Subscriptions",
    "thermal paste": "Store Supplies",
    "arctic mx-4": "Store Supplies",
    "alcohol wipes": "Store Supplies",
    "compressed air": "Store Supplies",
    "cable tie": "Store Supplies",
    "anti-static bag": "Store Supplies",
    "bubble wrap": "Packaging Materials",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "internet bill": "Utilities",
    converge: "Utilities",
    pldt: "Utilities",
    lalamove: "Transportation",
  },

  "Mobile Shop": {
    "iphone 15": "Phone & Gadgets",
    "iphone 14": "Phone & Gadgets",
    "iphone 13": "Phone & Gadgets",
    "iphone 12": "Phone & Gadgets",
    "samsung s24": "Phone & Gadgets",
    "samsung s23": "Phone & Gadgets",
    "samsung a55": "Phone & Gadgets",
    "samsung a35": "Phone & Gadgets",
    "samsung a15": "Phone & Gadgets",
    "vivo y": "Phone & Gadgets",
    "vivo v": "Phone & Gadgets",
    "oppo a": "Phone & Gadgets",
    "oppo f": "Phone & Gadgets",
    "oppo reno": "Phone & Gadgets",
    "realme c": "Phone & Gadgets",
    "realme gt": "Phone & Gadgets",
    "xiaomi redmi": "Phone & Gadgets",
    "xiaomi poco": "Phone & Gadgets",
    "huawei nova": "Phone & Gadgets",
    "huawei p": "Phone & Gadgets",
    "infinix hot": "Phone & Gadgets",
    "infinix note": "Phone & Gadgets",
    "tecno spark": "Phone & Gadgets",
    "cherry mobile": "Phone & Gadgets",
    myphone: "Phone & Gadgets",
    "nokia phone": "Phone & Gadgets",
    tablet: "Phone & Gadgets",
    ipad: "Phone & Gadgets",
    "samsung tab": "Phone & Gadgets",
    smartwatch: "Phone & Gadgets",
    "apple watch": "Phone & Gadgets",
    "galaxy watch": "Phone & Gadgets",
    airpods: "Accessories",
    earbud: "Accessories",
    "tws earphones": "Accessories",
    "wired earphone": "Accessories",
    "phone case": "Accessories",
    "tempered glass": "Accessories",
    "screen protector": "Accessories",
    "phone charger": "Accessories",
    "type-c charger": "Accessories",
    "lightning charger": "Accessories",
    "fast charger": "Accessories",
    "wireless charger": "Accessories",
    powerbank: "Accessories",
    "anker powerbank": "Accessories",
    "baseus powerbank": "Accessories",
    "usb-c cable": "Accessories",
    "lightning cable": "Accessories",
    "hdmi adapter": "Accessories",
    "sd card": "Accessories",
    "memory card": "Accessories",
    "sim ejector": "Accessories",
    "phone stand": "Accessories",
    "ring light": "Accessories",
    "selfie stick": "Accessories",
    "car mount": "Accessories",
    "bluetooth speaker": "Accessories",
    "shopping bag": "Packaging Materials",
    "bubble wrap": "Packaging Materials",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "internet bill": "Utilities",
    lalamove: "Transportation",
    "j&t": "Transportation",
    "flash express": "Transportation",
  },

  Bakery: {
    "all purpose flour": "Raw Materials",
    "all-purpose flour": "Raw Materials",
    "bread flour": "Raw Materials",
    "cake flour": "Raw Materials",
    "pastry flour": "Raw Materials",
    "white king flour": "Raw Materials",
    "maya flour": "Raw Materials",
    "magnolia flour": "Raw Materials",
    "washed sugar": "Raw Materials",
    "refined sugar": "Raw Materials",
    "brown sugar": "Raw Materials",
    "powdered sugar": "Raw Materials",
    "icing sugar": "Raw Materials",
    "muscovado sugar": "Raw Materials",
    "active dry yeast": "Raw Materials",
    "instant yeast": "Raw Materials",
    "saf yeast": "Raw Materials",
    "baking powder": "Raw Materials",
    "baking soda": "Raw Materials",
    "cream of tartar": "Raw Materials",
    "butter unsalted": "Raw Materials",
    "salted butter": "Raw Materials",
    "magnolia butter": "Raw Materials",
    "anchor butter": "Raw Materials",
    "margarine gold": "Raw Materials",
    "magnolia margarine": "Raw Materials",
    shortening: "Raw Materials",
    lard: "Raw Materials",
    "vegetable shortening": "Raw Materials",
    "all purpose cream": "Raw Materials",
    "nestle cream": "Raw Materials",
    "dream whip": "Raw Materials",
    "whipping cream": "Raw Materials",
    "heavy cream": "Raw Materials",
    "fresh milk": "Raw Materials",
    "evaporated milk": "Raw Materials",
    "condensed milk": "Raw Materials",
    "alaska milk": "Raw Materials",
    "bear brand milk": "Raw Materials",
    "nestle fresh milk": "Raw Materials",
    "quick melt cheese": "Raw Materials",
    "eden cheese": "Raw Materials",
    "kraft cheese": "Raw Materials",
    "cream cheese": "Raw Materials",
    ricotta: "Raw Materials",
    "whole eggs": "Raw Materials",
    "fresh eggs": "Raw Materials",
    "cocoa powder": "Raw Materials",
    "dutch processed cocoa": "Raw Materials",
    "hersheys cocoa": "Raw Materials",
    "dark chocolate": "Raw Materials",
    "milk chocolate": "Raw Materials",
    "white chocolate": "Raw Materials",
    "compound chocolate": "Raw Materials",
    "chocolate chips": "Raw Materials",
    "vanilla extract": "Raw Materials",
    "vanilla flavoring": "Raw Materials",
    "food color": "Raw Materials",
    "food coloring": "Raw Materials",
    fondant: "Raw Materials",
    gumpaste: "Raw Materials",
    "edible glitter": "Raw Materials",
    "edible ink": "Raw Materials",
    almond: "Raw Materials",
    walnut: "Raw Materials",
    cashew: "Raw Materials",
    raisin: "Raw Materials",
    "dried fruit": "Raw Materials",
    oats: "Raw Materials",
    "rolled oats": "Raw Materials",
    "cinnamon powder": "Raw Materials",
    nutmeg: "Raw Materials",
    "pandan extract": "Raw Materials",
    "ube flavor": "Raw Materials",
    "buko pandan": "Raw Materials",
    "strawberry flavor": "Raw Materials",
    "lemon extract": "Raw Materials",
    "orange extract": "Raw Materials",
    "corn starch": "Raw Materials",
    "tapioca starch": "Raw Materials",
    gelatin: "Raw Materials",
    "agar agar": "Raw Materials",
    "glucose syrup": "Raw Materials",
    honey: "Raw Materials",
    "maple syrup": "Raw Materials",
    "salt iodized": "Raw Materials",
    "sea salt": "Raw Materials",
    "cake box": "Packaging Materials",
    "bread bag": "Packaging Materials",
    "cupcake box": "Packaging Materials",
    "pastry box": "Packaging Materials",
    "cellophane bag": "Packaging Materials",
    "paper bag bakery": "Packaging Materials",
    ribbon: "Packaging Materials",
    "cake board": "Packaging Materials",
    "cake drum": "Packaging Materials",
    "cupcake liner": "Packaging Materials",
    "muffin liner": "Packaging Materials",
    "baking cup": "Packaging Materials",
    "twist tie": "Packaging Materials",
    "sticker label": "Packaging Materials",
    oven: "Equipment",
    "deck oven": "Equipment",
    "convection oven": "Equipment",
    "bread proofer": "Equipment",
    "dough mixer": "Equipment",
    "spiral mixer": "Equipment",
    "planetary mixer": "Equipment",
    "bread slicer": "Equipment",
    "dough sheeter": "Equipment",
    "laminator bakery": "Equipment",
    molder: "Equipment",
    divider: "Equipment",
    refrigerator: "Equipment",
    "display chiller": "Equipment",
    "cake display": "Equipment",
    "baking pan": "Store Supplies",
    "loaf pan": "Store Supplies",
    "muffin pan": "Store Supplies",
    "baking sheet": "Store Supplies",
    "piping bag": "Store Supplies",
    "piping tip": "Store Supplies",
    spatula: "Store Supplies",
    "cake turntable": "Store Supplies",
    "cake scraper": "Store Supplies",
    "wire rack": "Store Supplies",
    "rolling pin": "Store Supplies",
    "measuring cup": "Store Supplies",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    lpg: "Utilities",
    gasul: "Utilities",
    petron: "Transportation",
    lalamove: "Transportation",
    "j&t": "Transportation",
  },

  "Coffee Shop": {
    "coffee beans": "Raw Materials",
    "arabica beans": "Raw Materials",
    "robusta beans": "Raw Materials",
    "blend coffee": "Raw Materials",
    "espresso beans": "Raw Materials",
    "ground coffee": "Raw Materials",
    "instant coffee": "Raw Materials",
    nescafe: "Raw Materials",
    kopiko: "Raw Materials",
    "great taste": "Raw Materials",
    "matcha powder": "Raw Materials",
    "ceremonial matcha": "Raw Materials",
    "culinary matcha": "Raw Materials",
    "uji matcha": "Raw Materials",
    "milk tea powder": "Raw Materials",
    "taro powder": "Raw Materials",
    "brown sugar syrup": "Raw Materials",
    "sugar syrup": "Raw Materials",
    "caramel syrup": "Raw Materials",
    "vanilla syrup": "Raw Materials",
    "hazelnut syrup": "Raw Materials",
    "torani syrup": "Raw Materials",
    "monin syrup": "Raw Materials",
    "tapioca pearl": "Raw Materials",
    "boba pearl": "Raw Materials",
    "black pearl": "Raw Materials",
    "popping boba": "Raw Materials",
    "grass jelly": "Raw Materials",
    "nata de coco": "Raw Materials",
    "fresh milk": "Raw Materials",
    "full cream milk": "Raw Materials",
    "alaska milk": "Raw Materials",
    "bear brand milk": "Raw Materials",
    "oat milk": "Raw Materials",
    "almond milk": "Raw Materials",
    "soy milk": "Raw Materials",
    "condensed milk": "Raw Materials",
    "evaporated milk": "Raw Materials",
    "whipped cream": "Raw Materials",
    "all purpose cream": "Raw Materials",
    "cream powder": "Raw Materials",
    "non-dairy creamer": "Raw Materials",
    "coffee mate": "Raw Materials",
    "dark chocolate powder": "Raw Materials",
    "cocoa powder": "Raw Materials",
    ovaltine: "Raw Materials",
    "milo powder": "Raw Materials",
    "strawberry powder": "Raw Materials",
    "mango powder": "Raw Materials",
    "strawberry syrup": "Raw Materials",
    "passion fruit": "Raw Materials",
    lychee: "Raw Materials",
    "peach syrup": "Raw Materials",
    "washed sugar": "Raw Materials",
    "raw sugar": "Raw Materials",
    "brown sugar": "Raw Materials",
    stevia: "Raw Materials",
    "ice cubes": "Raw Materials",
    "cup 16oz": "Packaging Materials",
    "cup 22oz": "Packaging Materials",
    "cup 12oz": "Packaging Materials",
    "plastic cup": "Packaging Materials",
    "paper cup": "Packaging Materials",
    "hot cup": "Packaging Materials",
    "cold cup": "Packaging Materials",
    "cup lid": "Packaging Materials",
    "dome lid": "Packaging Materials",
    "flat lid": "Packaging Materials",
    straw: "Packaging Materials",
    "fat straw": "Packaging Materials",
    "paper straw": "Packaging Materials",
    "bubble straw": "Packaging Materials",
    "plastic bag": "Packaging Materials",
    "kraft bag": "Packaging Materials",
    "paper bag": "Packaging Materials",
    "cup sleeve": "Packaging Materials",
    "cup carrier": "Packaging Materials",
    "espresso machine": "Equipment",
    "coffee machine": "Equipment",
    "breville machine": "Equipment",
    "la marzocco": "Equipment",
    "nuova simonelli": "Equipment",
    "la pavoni": "Equipment",
    "coffee grinder": "Equipment",
    "burr grinder": "Equipment",
    "mahlkonig grinder": "Equipment",
    "mazzer grinder": "Equipment",
    blender: "Equipment",
    "commercial blender": "Equipment",
    "vitamix blender": "Equipment",
    "ninja blender": "Equipment",
    refrigerator: "Equipment",
    "display chiller": "Equipment",
    "ice maker": "Equipment",
    "ice blender": "Equipment",
    "sealer machine": "Equipment",
    "cup sealer": "Equipment",
    "milk frother": "Equipment",
    "steam wand": "Equipment",
    tamper: "Store Supplies",
    portafilter: "Store Supplies",
    "shot glass": "Store Supplies",
    "measuring pitcher": "Store Supplies",
    "thermometer barista": "Store Supplies",
    "latte art pen": "Store Supplies",
    "cleaning brush": "Store Supplies",
    "grouphead brush": "Store Supplies",
    descaler: "Store Supplies",
    "backflush disc": "Store Supplies",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    "internet bill": "Utilities",
    pldt: "Utilities",
    converge: "Utilities",
    lpg: "Utilities",
    petron: "Transportation",
    "grab delivery": "Transportation",
    lalamove: "Transportation",
    "j&t": "Transportation",
  },

  "Sari-Sari Store": {
    chippy: "Merchandise Inventory",
    nova: "Merchandise Inventory",
    piattos: "Merchandise Inventory",
    oishi: "Merchandise Inventory",
    "jack n jill": "Merchandise Inventory",
    "clover chips": "Merchandise Inventory",
    "chiz curl": "Merchandise Inventory",
    skyflakes: "Merchandise Inventory",
    hansel: "Merchandise Inventory",
    rebisco: "Merchandise Inventory",
    "monde biscuit": "Merchandise Inventory",
    "coca cola": "Merchandise Inventory",
    pepsi: "Merchandise Inventory",
    royal: "Merchandise Inventory",
    sprite: "Merchandise Inventory",
    "mountain dew": "Merchandise Inventory",
    "c2 green tea": "Merchandise Inventory",
    "nature spring": "Merchandise Inventory",
    "absolute water": "Merchandise Inventory",
    "datu puti": "Merchandise Inventory",
    "silver swan": "Merchandise Inventory",
    "mama sita": "Merchandise Inventory",
    "knorr cube": "Merchandise Inventory",
    "maggi savor": "Merchandise Inventory",
    "mang tomas": "Merchandise Inventory",
    "lucky me": "Merchandise Inventory",
    "payless noodles": "Merchandise Inventory",
    "nissin cup noodles": "Merchandise Inventory",
    "century tuna": "Merchandise Inventory",
    "mega sardines": "Merchandise Inventory",
    "argentina sardines": "Merchandise Inventory",
    "corned beef": "Merchandise Inventory",
    "palm corned beef": "Merchandise Inventory",
    "ligo sardines": "Merchandise Inventory",
    "bear brand milk": "Merchandise Inventory",
    "alaska powdered milk": "Merchandise Inventory",
    "milo sachet": "Merchandise Inventory",
    "nescafe sachet": "Merchandise Inventory",
    "kopiko sachet": "Merchandise Inventory",
    "great taste sachet": "Merchandise Inventory",
    "san mig coffee sachet": "Merchandise Inventory",
    marlboro: "Merchandise Inventory",
    "philip morris": "Merchandise Inventory",
    "fortune cigarette": "Merchandise Inventory",
    "hope cigarette": "Merchandise Inventory",
    "mighty cigarette": "Merchandise Inventory",
    "palmolive shampoo": "Merchandise Inventory",
    "sunsilk shampoo": "Merchandise Inventory",
    "head and shoulders": "Merchandise Inventory",
    "safeguard soap": "Merchandise Inventory",
    "dove soap": "Merchandise Inventory",
    colgate: "Merchandise Inventory",
    "close up": "Merchandise Inventory",
    "boy bawang": "Merchandise Inventory",
    "v-cut": "Merchandise Inventory",
    "sando bag": "Packaging Materials",
    "plastic bag": "Packaging Materials",
    meralco: "Utilities",
    "electric bill": "Utilities",
    "water bill": "Utilities",
    petron: "Transportation",
    lalamove: "Transportation",
  },
};

// ── Core categorization function ────────────────────────────────────────────

/**
 * Returns the most appropriate expense category for an item given the
 * registered business type.
 *
 * Logic:
 *  1. Product name database lookup (exact phrase match, highest priority)
 *  2. Apply business-specific primary category rules
 *  3. Fall back to base keyword map
 *  4. Return "General" if nothing matches
 */
export function categorizeItemForBusiness(
  itemTitle: string,
  businessType?: BusinessType | string | null,
): string {
  const lower = itemTitle.toLowerCase();

  // ── Step 0: Catch explicit "General" items first (highest priority) ──────
  // Items that should ALWAYS be General, regardless of other keywords
  const generalTerms = [
    "misc",
    "miscellaneous",
    "misc fee",
    "miscellaneous fee",
    "other",
    "others",
    "sundry",
  ];
  if (generalTerms.some((term) => containsWholeWord(lower, term))) {
    return "General";
  }

  // ── Step 1: Product name database lookup (highest priority) ─────────────
  if (businessType) {
    const db = PRODUCT_NAME_DATABASE[businessType as string];
    if (db) {
      for (const [phrase, category] of Object.entries(db)) {
        if (lower.includes(phrase.toLowerCase())) {
          return category;
        }
      }
    }
  }

  // ── Step 2: Business-specific keyword rules ──────────────────────────────
  switch (businessType) {
    // ── Food Business ────────────────────────────────────────────────────
    case "Food Business": {
      // Food items → Raw Materials (they are cooked/processed)
      if (containsAnyWholeWord(lower, FOOD_RAW_MATERIAL_KEYWORDS)) {
        return "Raw Materials";
      }
      break;
    }

    // ── Meat Shop ────────────────────────────────────────────────────────
    case "Meat Shop": {
      // Meat products → Merchandise Inventory (sold directly)
      if (containsAnyWholeWord(lower, MERCHANDISE_KEYWORDS)) {
        return "Merchandise Inventory";
      }
      // Ice, sawdust, hooks etc. are store supplies for a meat shop
      if (
        containsAnyWholeWord(lower, [
          "ice",
          "sawdust",
          "hook",
          "tray",
          "container",
        ])
      ) {
        return "Store Supplies";
      }
      break;
    }

    // ── Printing Services / Printing Business ────────────────────────────
    case "Printing Services":
    case "Printing Business": {
      // Only printing materials → Raw Materials (NOT food items)
      if (containsAnyWholeWord(lower, PRINTING_RAW_MATERIAL_KEYWORDS)) {
        return "Raw Materials";
      }
      break;
    }

    // ── Construction ─────────────────────────────────────────────────────
    case "Construction": {
      if (containsAnyWholeWord(lower, CONSTRUCTION_MATERIAL_KEYWORDS)) {
        return "Construction Materials";
      }
      if (
        containsAnyWholeWord(lower, [
          "labor",
          "worker",
          "contractor",
          "subcontractor",
          "skilled",
          "artisan",
        ])
      ) {
        return "Labor & Subcontracting";
      }
      break;
    }

    // ── Retail ───────────────────────────────────────────────────────────
    case "Retail": {
      if (containsAnyWholeWord(lower, MERCHANDISE_KEYWORDS)) {
        return "Merchandise Inventory";
      }
      break;
    }

    // ── Water Station ─────────────────────────────────────────────────
    case "Water Station": {
      if (
        containsAnyWholeWord(lower, [
          "water",
          "distilled",
          "refill",
          "gallon",
          "container",
          "dispenser",
        ])
      ) {
        return "Water Supplies";
      }
      if (containsAnyWholeWord(lower, MERCHANDISE_KEYWORDS)) {
        return "Gallon/Container Inventory";
      }
      break;
    }

    // ── Laundry Shop ──────────────────────────────────────────────────
    case "Laundry Shop": {
      if (
        containsAnyWholeWord(lower, [
          "detergent",
          "bleach",
          "fabric conditioner",
          "softener",
          "soap",
          "laundry",
        ])
      ) {
        return "Detergents & Chemicals";
      }
      break;
    }

    // ── Internet Cafe ───────────────────────────────────────────────────
    case "Internet Cafe": {
      if (containsAnyWholeWord(lower, ["internet", "wifi", "load", "data"])) {
        return "Internet Services";
      }
      if (
        containsAnyWholeWord(lower, [
          "computer",
          "pc",
          "laptop",
          "cpu",
          "monitor",
          "keyboard",
          "mouse",
          "headset",
        ])
      ) {
        return "Computer Equipment";
      }
      break;
    }

    // ── Beauty Salon ───────────────────────────────────────────────────
    case "Beauty Salon": {
      if (
        containsAnyWholeWord(lower, [
          "shampoo",
          "conditioner",
          "hair dye",
          "bleach",
          "perm",
          "treatment",
          "styling",
          "gel",
          "wax",
          "pomade",
          "hair spray",
        ])
      ) {
        return "Hair & Beauty Products";
      }
      break;
    }

    // ── Repair Shop ───────────────────────────────────────────────────
    case "Repair Shop": {
      if (
        containsAnyWholeWord(lower, [
          "part",
          "component",
          "spare",
          "replacement",
          "screen",
          "battery",
          "charger",
          "cable",
        ])
      ) {
        return "Parts & Components";
      }
      if (
        containsAnyWholeWord(lower, [
          "tool",
          "solder",
          "multimeter",
          "screwdriver",
          "wrench",
        ])
      ) {
        return "Tools";
      }
      break;
    }

    // ── Pharmacy ────────────────────────────────────────────────────────
    case "Pharmacy": {
      if (
        [
          "medicine",
          "drug",
          "tablet",
          "capsule",
          "syrup",
          "prescription",
          "OTC",
          "pharma",
        ].some((kw) => lower.includes(kw))
      ) {
        return "Medicines & Drugs";
      }
      if (
        [
          "bandage",
          "gauze",
          "cotton",
          "alcohol",
          "betadine",
          "thermometer",
          "bp monitor",
        ].some((kw) => lower.includes(kw))
      ) {
        return "Medical Supplies";
      }
      break;
    }

    // ── Convenience Store ─────────────────────────────────────────────
    case "Convenience Store": {
      if (containsAnyWholeWord(lower, MERCHANDISE_KEYWORDS)) {
        return "Merchandise Inventory";
      }
      break;
    }

    // ── Hardware ──────────────────────────────────────────────────────
    case "Hardware": {
      if (containsAnyWholeWord(lower, CONSTRUCTION_MATERIAL_KEYWORDS)) {
        return "Hardware Inventory";
      }
      if (
        containsAnyWholeWord(lower, [
          "tool",
          "hammer",
          "saw",
          "drill",
          "wrench",
          "screwdriver",
          "plier",
        ])
      ) {
        return "Hardware Inventory";
      }
      break;
    }

    // ── Computer Shop ───────────────────────────────────────────────────
    case "Computer Shop": {
      if (
        containsAnyWholeWord(lower, [
          "cpu",
          "processor",
          "motherboard",
          "ram",
          "hard disk",
          "ssd",
          "gpu",
          "graphics card",
          "psu",
          "case",
          "fan",
        ])
      ) {
        return "Computer Parts";
      }
      if (
        containsAnyWholeWord(lower, [
          "mouse",
          "keyboard",
          "headset",
          "webcam",
          "monitor",
          "speaker",
          "cable",
          "adapter",
        ])
      ) {
        return "Accessories";
      }
      break;
    }

    // ── Mobile Shop ───────────────────────────────────────────────────
    case "Mobile Shop": {
      if (
        containsAnyWholeWord(lower, [
          "phone",
          "smartphone",
          "tablet",
          "gadget",
          "iphone",
          "samsung",
          "vivo",
          "oppo",
          "realme",
          "xiaomi",
        ])
      ) {
        return "Phone & Gadgets";
      }
      if (
        containsAnyWholeWord(lower, [
          "case",
          "charger",
          "cable",
          "headset",
          "earphone",
          "powerbank",
          "screen protector",
        ])
      ) {
        return "Accessories";
      }
      break;
    }

    // ── Bakery ────────────────────────────────────────────────────────
    case "Bakery": {
      if (containsAnyWholeWord(lower, FOOD_RAW_MATERIAL_KEYWORDS)) {
        return "Raw Materials";
      }
      break;
    }

    // ── Coffee Shop ───────────────────────────────────────────────────
    case "Coffee Shop": {
      if (containsAnyWholeWord(lower, FOOD_RAW_MATERIAL_KEYWORDS)) {
        return "Raw Materials";
      }
      break;
    }

    // ── Sari-Sari Store ────────────────────────────────────────────────
    case "Sari-Sari Store": {
      if (containsAnyWholeWord(lower, MERCHANDISE_KEYWORDS)) {
        return "Merchandise Inventory";
      }
      break;
    }

    default:
      // "Others" — try food/printing raw materials first, then merchandise
      if (containsAnyWholeWord(lower, FOOD_RAW_MATERIAL_KEYWORDS)) {
        return "Raw Materials";
      }
      if (containsAnyWholeWord(lower, PRINTING_RAW_MATERIAL_KEYWORDS)) {
        return "Raw Materials";
      }
      if (containsAnyWholeWord(lower, MERCHANDISE_KEYWORDS)) {
        return "Merchandise Inventory";
      }
      break;
  }

  // ── Base keyword fallback (shared across all business types) ────────────
  for (const [category, keywords] of Object.entries(BASE_KEYWORDS)) {
    if (containsAnyWholeWord(lower, keywords)) {
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

⚠️ STRICT CATEGORY ENFORCEMENT ⚠️
YOU MUST ONLY USE THESE EXACT CATEGORIES: ${categoryList}

DO NOT use any other category names, even if they seem appropriate. Categories like "Bank Charges", "Insurance", "Licenses & Permits", "Security Services" (if not listed above), or any other category name NOT in the list above should be categorized as "General".

IMPORTANT: Items explicitly marked as "misc", "miscellaneous", "misc fee", "other", or "others" should ALWAYS be categorized as "General" regardless of any other keywords they might contain.

If an item matches keywords for a category that is NOT in the allowed list above, use "General" instead.

CRITICAL: The SAME item may belong to DIFFERENT categories depending on the business type. Always consider the business context when categorizing.`;

  const categoryWarning = `

⚠️ REMINDER: ONLY use categories from this list: ${categoryList}
If an expense doesn't fit any specific category above, use "General". DO NOT invent or use category names not in this list.`;

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
- "Chicken" → "Raw Materials" (used to cook meals, NOT Merchandise Inventory)
- "Rice" → "Raw Materials" (used as ingredient)
- "Plastic bag" → "Packaging Materials"
- "Detergent" → "Store Supplies" (for cleaning the shop)

CROSS-BUSINESS DISAMBIGUATION — in this Food Business:
- Chicken/pork/beef/fish → "Raw Materials" (you COOK these, not sell raw)
- Oil (Minola, palm oil, cooking oil) → "Raw Materials" (consumed in cooking)
- Sugar, flour → "Raw Materials" (used in food preparation)
- LPG, Gasul, Shellane → "Utilities" (cooking fuel)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Raw Materials: Minola cooking oil, Golden Fiesta palm oil, Datu Puti vinegar/soy sauce, Silver Swan soy sauce, UFC ketchup, Mama Sita seasonings, Knorr cubes, Maggi savor, Ajinomoto, Lucky Me noodles, Payless noodles, Sinandomeng rice, Dinorado rice, Milagrosa rice, Alaska evap milk, Bear Brand milk, Nestle condensed milk, Eden cheese, Quick Melt cheese, White King flour, Maya flour, Blue Key baking powder, SAF yeast, Anchor butter, Gold Medal margarine, All Purpose cream, Nestle cream
Packaging Materials: Sando bag, poly bag, cling wrap, styrofoam containers, paper cups, plastic cups with lids, straws, mami bowl, paper bag
Store Supplies: Joy dishwashing, Domex, Zonrox bleach, Ariel detergent, Tide detergent, Lysol, Mr. Clean, Axion dish soap, Champion detergent
Utilities: Meralco bill, Maynilad bill, Manila Water bill, PLDT broadband, Converge fiber, Globe fiber, Gasul LPG, Shellane LPG, Primus LPG, Solane LPG
Transportation: Petron fuel, Shell gasoline, Caltex fuel, Seaoil, Phoenix fuel, Lalamove, GrabExpress, LBC, J&T Express, Flash Express

⚠️ STRICT ENFORCEMENT: Use ONLY the categories listed at the top. Do NOT use "Bank Charges", "Insurance", "Licenses & Permits", or any other category not explicitly listed. If an item doesn't clearly fit the listed categories, use "General".`;

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
- "Weighing scale" → "Equipment"

CROSS-BUSINESS DISAMBIGUATION — in this Meat Shop:
- Chicken, pork, beef, fish, seafood → "Merchandise Inventory" (you SELL these raw, don't cook them)
- Ice, block ice → "Ice & Cold Storage" (not Utilities, not Store Supplies)
- Knives, cleavers, chopping boards → "Store Supplies" (tools of trade)
- Freezers, display chillers → "Equipment"

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Merchandise Inventory: Magnolia chicken, Bounty Fresh chicken, dressed chicken, farm chicken, liempo, kasim, pigue, baryete, pork spare ribs, bulalo beef, bangus, tilapia, tanigue, galunggong, maya-maya, lapu-lapu, hipon, pusit, alimango, tahong, talaba, longganisa, tocino, tapa, chorizo, hotdog, pork sausage
Ice & Cold Storage: Block ice, crushed ice, ice delivery, tubig na yelo
Store Supplies: Meat hooks, styrotray, chopping board, butcher paper, cling wrap, boning knife, cleaver, gloves, apron
Equipment: Chest freezer, display chiller, weighing scale, meat slicer, meat grinder, band saw
Utilities: Meralco bill, electric bill, water bill
Transportation: Petron fuel, Shell gasoline, Caltex, delivery van fuel, Lalamove, trucking fee

⚠️ STRICT ENFORCEMENT: Use ONLY the categories listed at the top. Do NOT use "Bank Charges", "Insurance", "Licenses & Permits", or any other category not explicitly listed. If an item doesn't clearly fit the listed categories, use "General".`;

    case "Printing Services":
    case "Printing Business":
      return `${baseIntro}

CATEGORY RULES FOR PRINTING SERVICES / PRINTING BUSINESS:
- "Raw Materials" (PRIMARY): ink (all types), toner, printing paper (A4, A3, letter, legal, tabloid), tarpaulin, vinyl, canvas, substrates, laminate film (cold lamination, hot lamination), adhesive, cutting mat, print film, proofing paper, cardboard, bond paper, thermal paper, sticker paper, magnetic sheet, foam board.
  ⚠️ NOTE: Raw Materials are ONLY printing supplies (ink, toner, paper, vinyl). Food items like bread, chicken, rice, etc. are NOT Raw Materials for a printing business.
- "Equipment": printers (laser, inkjet, large format), cutters, laminators, heat presses, binding machines (spiral, thermal, perfect), trimmers, guillotines, scanners, computers, monitors, routers.
- "Store Supplies": cleaning supplies, office supplies, uniforms, gloves, aprons, snacks/food for staff consumption.
- "Packaging Materials": boxes, tubes, protective wrap, bubble wrap, cardboard boxes, mailing envelopes.
- "Utilities": electricity, internet, phone bills.
- "Transportation": delivery fees, fuel, courier services.

EXAMPLES OF CONTEXT-AWARE CATEGORIZATION:
- "Ink" → "Raw Materials" (consumed in printing)
- "Toner" → "Raw Materials" (consumed)
- "Paper A4" → "Raw Materials" (consumed)
- "Tarpaulin" → "Raw Materials" (used in printing jobs)
- "Bread" → "Store Supplies" or "General" (NOT Raw Materials - it's food for staff)
- "Chicken" → "Store Supplies" or "General" (NOT Raw Materials - it's food for staff)
- "Printer" → "Equipment"
- "Laminator" → "Equipment"

CROSS-BUSINESS DISAMBIGUATION — in this Printing Services/Printing Business:
- Paper → "Raw Materials" (consumed, NOT Merchandise Inventory)
- Tarpaulin → "Raw Materials" (printing substrate, not just a big plastic sheet)
- Ink/Toner → "Raw Materials" (consumed in every job)
- Food items (bread, rice, chicken, etc.) → "Store Supplies" or "General" (for staff consumption, NOT Raw Materials)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Raw Materials: Epson ink, Canon ink, HP ink, Brother ink, eco-solvent ink, sublimation ink, UV ink, DTF ink, pigment ink, dye ink, Epson toner, Canon toner, bond paper A4, bond paper A3, legal-size paper, short bond paper, tarpaulin / tarp, vinyl sticker, canvas, backlit film, cold laminate, hot laminate, laminating pouch, sticker paper, foam board, Sintra board, corflute, DTF film, heat transfer paper, NCR paper, thermal paper
Equipment: Epson large format printer, Canon printer, Roland wide-format, Mimaki printer, HP DesignJet, laminator machine, heat press, cutter plotter, vinyl cutter, guillotine cutter, paper trimmer, binding machine, spiral binder, scanner
Store Supplies: Office supplies, snacks, coffee, bread, biscuits for staff (NOT Raw Materials)
Utilities: Meralco bill, Converge fiber, PLDT fiber, Globe broadband
Transportation: Petron fuel, Shell gasoline, Lalamove, GrabExpress, LBC courier

⚠️ STRICT ENFORCEMENT: Use ONLY the categories listed at the top. Do NOT use "Bank Charges", "Insurance", "Licenses & Permits", or any other category not explicitly listed. If an item doesn't clearly fit the listed categories, use "General".`;

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
- "Generator" → "Equipment"

CROSS-BUSINESS DISAMBIGUATION — in this Construction business:
- Paint → "Construction Materials" (applied to walls/surfaces, not sold)
- Nails, screws, bolts → "Construction Materials" (consumed on site)
- Hard hat, safety vest → "Safety Equipment" (not Store Supplies)
- Mason, carpenter, plumber wages → "Labor & Subcontracting"

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Construction Materials: Holcim cement, Portland cement, Sahara cement, Republic cement, CHB/hollow blocks, 10mm rebar, 12mm rebar, 16mm rebar, GI wire, tie wire, ordinary plywood, marine plywood, coco lumber, 2x3 lumber, 2x4 lumber, GI roofing sheet, pre-painted sheet, Boysen paint, Davies paint, Nippon paint, Dutch Boy paint, white latex, PVC pipe, GI pipe, ball valve, gate valve, floor tile, wall tile, ceramic tile, tile adhesive/tile grout, waterproofing, door knob, padlock, hinges, tekscrew, common nails, concrete nails, masking tape, sandpaper, thinner, Araldite epoxy, silicone sealant
Tools & Hardware: Hammer, handsaw, circular saw, angle grinder, electric drill, impact driver, rotary hammer, level, tape measure, trowel, paint roller, shovel, wheelbarrow, ladder
Safety Equipment: Hard hat, safety helmet, safety vest, safety harness, safety shoes, work gloves, safety goggles, dust mask
Labor & Subcontracting: Mason labor, carpenter labor, electrician fee, plumber fee, welder, painter fee, foreman, contractor fee, subcontractor
Utilities: Meralco, temporary electric, water bill
Transportation: Petron fuel, Shell gasoline, Caltex, Lalamove trucking, hauling fee, material delivery

⚠️ STRICT ENFORCEMENT: Use ONLY the categories listed at the top. Do NOT use "Bank Charges", "Insurance", "Rent" (if not listed), or any other category not explicitly listed. If an item doesn't clearly fit the listed categories, use "General".`;

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
- "POS machine" → "Equipment"

CROSS-BUSINESS DISAMBIGUATION — in this Retail business:
- ALL products purchased for resale → "Merchandise Inventory" regardless of what they are
- Shopping bags, gift wrap → "Packaging Materials" (not Store Supplies)
- Hangers, display racks → "Store Supplies"

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Merchandise Inventory: All products bought for resale (clothing, shoes, accessories, personal care, household, electronics, food items sold as-is)
Packaging Materials: Sando bag, shopping bag, paper bag, gift wrap, ribbon, tissue paper, bubble wrap
Store Supplies: Hanger, price tag, barcode sticker, display rack, mannequin, cleaning supplies
Equipment: POS machine / cash register, barcode scanner, weighing scale, CCTV, aircon, refrigerator
Security Services: Security guard fee, alarm system, CCTV monitoring
Utilities: Meralco, Maynilad, PLDT, Converge, Globe fiber
Transportation: Petron fuel, Shell gasoline, Lalamove, GrabExpress, LBC, J&T Express, Flash Express`;

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
- "Chlorine" → "Water Supplies"

CROSS-BUSINESS DISAMBIGUATION — in this Water Station:
- Distilled/purified water → "Water Supplies" (input/product, not Utilities)
- Empty gallons for rent/sale → "Gallon/Container Inventory"
- RO machine, UV lamp → "Equipment" (not Utilities)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Water Supplies: Distilled water refill, purified water, mineral water, water treatment chemicals, chlorine tablet, filtration media, activated carbon, sediment filter cartridge, RO membrane, UV sterilizer lamp
Gallon/Container Inventory: 19L empty gallon, 5 gallon jug, round container, slim gallon, gallon cap/seal
Equipment: RO filtration machine, reverse osmosis unit, water pump, storage tank, water dispenser, pressure tank
Utilities: Meralco (big pump uses a lot), water bill (source water), PLDT, Globe
Transportation: Delivery van fuel, Petron, Shell gasoline, Lalamove`;

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
- "Plastic bag" → "Packaging Materials"

CROSS-BUSINESS DISAMBIGUATION — in this Laundry Shop:
- Detergent, bleach, fabric conditioner → "Detergents & Chemicals" (not Store Supplies)
- Washing machines, dryers, steam iron → "Equipment"
- Hangers → "Store Supplies" (for hanging finished laundry)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Detergents & Chemicals: Ariel detergent, Surf detergent, Tide detergent, Champion detergent, Breeze detergent, Perla laundry soap, Downy fabric softener, Comfort fabric conditioner, Zonrox bleach, Vanish stain remover, Star bleach, laundry starch, laundry perfume, scent booster
Equipment: Industrial washing machine, commercial dryer, steam iron, steam press, ironing board, laundry cart, weighing scale
Packaging Materials: Garment bag, plastic cover, laundry bag
Store Supplies: Hanger, laundry tag, permanent marker, cleaning supplies for floor
Utilities: Meralco (machines use a lot), water bill, internet bill
Transportation: Grab delivery, Lalamove for pick-up/delivery`;

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
- "Antivirus" → "Software Subscriptions"

CROSS-BUSINESS DISAMBIGUATION — in this Internet Cafe:
- Internet bill, broadband subscription → "Internet Services" (not Utilities)
- Any PC part, monitor, keyboard, mouse, headset → "Computer Equipment"
- Windows license, antivirus, gaming software → "Software Subscriptions"
- Electricity bill → "Utilities" (separate from Internet Services)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Internet Services: Converge FiberX, PLDT Fiber, Globe Fiber, Sky Broadband, Smart Bro, Sun Broadband, static IP, domain hosting, monthly internet subscription
Computer Equipment: Desktop PC/gaming PC units, all-in-one PC, CPU set, monitor (24", 27", 144hz), mechanical keyboard, gaming mouse, gaming headset, webcam, router (TP-Link, D-Link, ASUS), network switch, modem, ethernet cable Cat5e/Cat6, UPS (APC, Eaton), gaming chair
Software Subscriptions: Windows 10/11 license, Kaspersky antivirus, ESET antivirus, Microsoft Office 365, Steam games, Roblox, Valorant account
Store Supplies: Alcohol wipes, cleaning kit, mouse pad foam
Utilities: Meralco bill, electric bill, water bill
Maintenance & Repairs: Aircon cleaning, computer cleaning service`;

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
- "Towel" → "Store Supplies"

CROSS-BUSINESS DISAMBIGUATION — in this Beauty Salon:
- Shampoo, conditioner → "Hair & Beauty Products" (used on clients, not Store Supplies)
- Bleach → "Hair & Beauty Products" (hair bleaching product, NOT cleaning bleach)
- Towels → "Store Supplies" (used to wrap client hair)
- Scissors, clippers → "Equipment" (tools for the trade)
- Acetone, nail polish remover → "Hair & Beauty Products" (beauty product)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Hair & Beauty Products: L'Oreal hair color, Wella Koleston, Schwarzkopf Igora, Majirel hair dye, bleaching powder (Majiblond, BlondMe), oxydant developer (3%, 6%, 9%, 12%), Wella rebonding set, Salon Selectives, Pantene Pro-V salon, Biore, OPI nail polish, Essie nail polish, nail gel, bio gel, acrylic powder, acrylic liquid, gel base/top coat, acetone, nail tips, wax beans, facial cleaning products
Equipment: Parlux hair dryer, professional flat iron, curling wand, salon chair (styling chair), shampoo bowl, UV/LED nail lamp, nail drill machine, facial steamer, salon scissors (Yasaka, Kamisori, Joewell), hair clippers, trimmer
Store Supplies: Salon towel, salon cape, neck strip, aluminum foil sheet, mixing bowl, color brush, tail comb, wide tooth comb
Utilities: Meralco bill, water bill, internet bill
Transportation: Petron fuel, Lalamove, GrabExpress`;

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
- "IPA alcohol" → "Store Supplies"

CROSS-BUSINESS DISAMBIGUATION — in this Repair Shop:
- LCD screen, OLED display → "Parts & Components" (replacement part, not Equipment)
- Battery → "Parts & Components" (replacement part)
- Soldering iron → "Tools" (your tool, not a part)
- IPA alcohol, cleaning solution → "Store Supplies" (cleaning, not Parts)
- Thermal paste/pad → "Store Supplies" (consumable, not Parts)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Parts & Components: iPhone screen (OEM/aftermarket), Samsung AMOLED, LCD digitizer, phone battery (Li-Po, Li-ion), Maxxis battery, laptop battery, USB-C charging port, lightning port, flex cable, ribbon cable, IC chip (NAND, CPU, PMIC), SIM tray, back glass, frame/housing, front camera module, rear camera module, fingerprint reader, speaker mesh, earpiece receiver, vibrator motor, laptop keyboard, laptop fan, RAM card, HDD, SSD
Tools: Pentalobe screwdriver, Torx screwdriver set, precision screwdriver kit, iFixit tools, spudger, pry tool, suction cup, anti-static tweezers, JBC soldering iron, Hakko soldering iron, solder wire, flux paste, hot air station (Quick, Yihua), heat gun, multimeter, oscilloscope, DC power supply
Store Supplies: IPA 70%/99%, cleaning solution, thermal paste (Arctic MX-4, Noctua), thermal pad, Kapton tape, double-sided tape, OCA glue, B7000 adhesive, T7000 adhesive, UV glue
Equipment: Trinocular microscope, workbench, rework station, inspection lamp
Utilities: Meralco bill, internet bill`;

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
- "Medicine refrigerator" → "Equipment"

CROSS-BUSINESS DISAMBIGUATION — in this Pharmacy:
- Alcohol (isopropyl, ethyl) → "Medical Supplies" (antiseptic, not Detergents)
- Vitamins, supplements → "Medicines & Drugs" (health products)
- Thermometer, BP monitor → "Medical Supplies" (diagnostic tools, not Equipment)
- Medicine refrigerator / cold storage → "Equipment"

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Medicines & Drugs: Biogesic paracetamol, Tempra syrup, Alaxan FR, Medicol advance, Ibuprofen, Ponstan mefenamic, Decolgen, Neozep forte, Tuseran forte, Solmux, Ascof lagundi, Vitamin C 500mg, Enervon multivitamin, Stresstabs, Berocca, Myra E, zinc supplement, Losartan, Amlodipine, Atorvastatin, Metformin, Omeprazole, Amoxicillin 500mg, Azithromycin, Cetirizine, Loratadine, Condom (Trust, Durex)
Medical Supplies: Gauze pad, cotton balls, bandage, Betadine solution, isopropyl alcohol 70%, ethyl alcohol 70%, Zonrox wound care, Band-Aid, digital thermometer, Omron BP monitor, blood glucose meter, lancet, test strip, disposable syringe, IV catheter, face mask, nitrile gloves
Equipment: Medicine refrigerator, pharmacy chiller, weighing scale, nebulizer (Omron), pulse oximeter
Utilities: Meralco (cold storage critical), water bill, internet bill
Transportation: Courier fee for medicine delivery, fuel, Lalamove`;

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
- "POS machine" → "Equipment"

CROSS-BUSINESS DISAMBIGUATION — in this Convenience Store:
- ALL consumer goods (snacks, beverages, personal care, cigarettes) → "Merchandise Inventory"
- Shopping/plastic/sando bags → "Packaging Materials" (not Merchandise Inventory)
- POS machine, cash register → "Equipment"

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Merchandise Inventory: Chippy, Nova, Piattos, Oishi, Jack 'n Jill, Clover chips, Chiz Curl, V-Cut, Skyflakes, Hansel, Rebisco, Monde biscuits, Coca-Cola, Pepsi, Royal, Sprite, Mountain Dew, C2 Green Tea, Nature Spring water, Absolute water, Red Bull, Sting energy, Lucky Me noodles, Payless noodles, Nissin Cup Noodles, Century Tuna, Mega Sardines, Argentina sardines, Bear Brand milk, Alaska powdered milk, Milo sachet, Nescafe sachet, Kopiko sachet, Marlboro, Philip Morris, Fortune, Hope cigarettes, Palmolive shampoo, Safeguard soap, Colgate
Packaging Materials: Sando bag, plastic bag, shopper bag, paper bag
Equipment: POS machine, cash register, beverage refrigerator, freezer, CCTV, microwave
Utilities: Meralco, water bill, internet`;

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
- "PVC pipe" → "Hardware Inventory"

CROSS-BUSINESS DISAMBIGUATION — in this Hardware Store:
- ALL products for sale (nails, paint, pipes, tools, electrical) → "Hardware Inventory"
- Shopping bags → "Packaging Materials"
- Store cleaning supplies, price tags → "Store Supplies"

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Hardware Inventory: Holcim/Portland cement, CHB hollow blocks, plywood (ordinary, marine), coco lumber, GI roofing sheet, rebar/deformed bar, GI wire, PVC pipe (1/2", 3/4", 1", 2"), GI pipe, ball valve, gate valve, pvc elbow/tee, Boysen paint, Davies paint, Nippon paint, Dutch Boy paint, white latex, enamel paint, wood stain, primer, thinner, putty, tekscrew, common nails, concrete nails, roofing nails, LED bulb, fluorescent lamp, CFL bulb, extension cord, power strip, light switch, electrical outlet, THHN wire, circuit breaker, conduit pipe, floor tile, wall tile, tile adhesive, grout, door knob, padlock, hinges, sandpaper, masking tape
Store Supplies: Shopping bag, price tag, sticker label, cleaning supplies, uniform
Utilities: Meralco bill, water bill, internet bill
Transportation: Delivery van fuel, Petron, Shell gasoline, Lalamove, trucking fee`;

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
- "Anti-static wristband" → "Store Supplies"

CROSS-BUSINESS DISAMBIGUATION — in this Computer Shop:
- CPU/processor, motherboard, RAM, SSD, GPU → "Computer Parts" (core PC components)
- Mouse, keyboard, headset, cable, monitor → "Accessories" (peripherals)
- Windows license, antivirus → "Software Subscriptions"
- Thermal paste, alcohol wipes, cable ties → "Store Supplies" (consumables)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Computer Parts: Intel Core i3/i5/i7/i9, AMD Ryzen 3/5/7/9, ASUS/MSI/Gigabyte/ASRock motherboard, DDR4/DDR5 RAM (Kingston, Corsair, G.Skill, TeamGroup, Crucial), Seagate/WD HDD, Samsung/Kingston/Crucial SSD, NVMe M.2 SSD, RTX 4060/4070/4080, GTX 1660 Super, RX 6600/6700 GPU, Corsair/Seasonic/FSP PSU, NZXT/Deepcool/Corsair case, Noctua/Coolermaster CPU cooler, case fans
Accessories: Logitech/Razer wireless mouse, mechanical keyboard, gaming headset (HyperX, Logitech, Razer), 24"/27" IPS/144hz monitor, USB hub, HDMI cable, DisplayPort cable, ethernet cable, APC UPS, gaming mousepad, webcam, RGB fans, laptop stand
Software Subscriptions: Windows 10/11 OEM license, MS Office 2021/365, Kaspersky, ESET antivirus
Store Supplies: Thermal paste (Arctic MX-4), compressed air, alcohol wipes, cable ties, anti-static bag
Packaging Materials: Shipping box, bubble wrap, foam, anti-static wrap
Utilities: Meralco, Converge, PLDT, Globe fiber
Transportation: Lalamove, GrabExpress, J&T Express, LBC`;

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
- "Display stand" → "Store Supplies"

CROSS-BUSINESS DISAMBIGUATION — in this Mobile Shop:
- ALL smartphones, tablets, smartwatches → "Phone & Gadgets"
- Cases, chargers, cables, powerbanks, earphones → "Accessories"
- Tempered glass, screen protectors → "Accessories"
- Display stands, price tags → "Store Supplies"

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Phone & Gadgets: iPhone 12/13/14/15 (Pro, Pro Max), Samsung Galaxy S23/S24, Samsung A15/A35/A55, Vivo Y/V series, OPPO A/F/Reno series, Realme C/GT series, Xiaomi Redmi/POCO, Huawei Nova/P series, Infinix Hot/Note, Tecno Spark, Cherry Mobile, myPhone, Nokia, iPad, Samsung Tab, Apple Watch, Galaxy Watch, Garmin smartwatch
Accessories: AirPods Pro, TWS earbuds (JBL, Sony, Anker), OPI earphone, wired earphone, phone case (Spigen, OtterBox), tempered glass, screen protector, USB-C/Lightning charger (Anker, Baseus), fast charger GaN, wireless charger, Anker powerbank, Baseus powerbank, USB-C cable, Lightning cable, micro-USB cable, HDMI adapter, SD card (Samsung, SanDisk), phone stand, ring light, selfie stick, car mount, Bluetooth speaker (JBL, Marshall)
Packaging Materials: Sando bag, bubble wrap, paper bag, phone box
Store Supplies: Display stand, price tag, sticker label, cleaning cloth
Utilities: Meralco, internet bill, Converge, PLDT
Transportation: J&T Express, Flash Express, Lalamove, GrabExpress, LBC`;

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
- "Piping bag" → "Store Supplies"

CROSS-BUSINESS DISAMBIGUATION — in this Bakery:
- Flour, sugar, butter, eggs, yeast → "Raw Materials" (baking ingredients)
- Bleach / Zonrox → "Store Supplies" (cleaning, NOT Hair & Beauty Products)
- Bread bags, cake boxes → "Packaging Materials"
- Stand mixer, oven → "Equipment"
- Piping bags, baking pans → "Store Supplies" (reusable tools)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Raw Materials: White King all-purpose flour, Maya flour, Magnolia flour, washed/refined sugar, brown sugar, powdered sugar, SAF instant yeast, Fleischmann's yeast, Blue Key baking powder, Arm & Hammer baking soda, Anchor/Magnolia butter, Gold Medal margarine, Dari Crème margarine, all-purpose cream (Nestle, Alaska), condensed milk (Nestle, Alaska), evaporated milk (Carnation, Alpine), Eden cheese, Quick Melt cheese, whole eggs, cocoa powder (Hershey's, Milo, Van Houten), dark chocolate compound, milk chocolate compound, white chocolate, Kirkland vanilla extract, food color, fondant, icing sugar, cream of tartar, almond (whole, sliced), raisin, walnut, chocolate chips, pandan extract, ube flavoring
Packaging Materials: Bread bag, cake box, cupcake box, cellophane bag, paper bag, ribbon, cake board, cake drum, cupcake liner/baking cup, twist tie, sticker label, cling wrap
Equipment: Convection oven, deck oven, stand mixer (KitchenAid, Hobart, Bosch), spiral dough mixer, proofing box, display chiller, bread slicer, dough sheeter
Store Supplies: Baking pan (loaf, round, square), muffin pan, piping bag, piping tip, spatula, turntable, wire rack, rolling pin, parchment paper, baking mat
Utilities: Meralco, Gasul/LPG (Shellane, Solane, Primus), water bill
Transportation: Lalamove, J&T, GrabExpress`;

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
- "Espresso machine" → "Equipment"

CROSS-BUSINESS DISAMBIGUATION — in this Coffee Shop:
- Coffee beans, matcha powder, milk, syrup, pearls → "Raw Materials" (consumed in drinks)
- Cups, lids, straws, cup sleeves → "Packaging Materials"
- Espresso machine, grinder, blender → "Equipment"
- Internet/WiFi subscription → "Utilities" (for shop operations)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Raw Materials: Arabica coffee beans, robusta coffee beans, espresso blend, Nescafe instant, Kopiko 78°C, Bench Brew matcha, ceremonial matcha, culinary matcha, Torani syrup (caramel, vanilla, hazelnut), Monin syrup, brown sugar syrup, CDR simple syrup, fresh milk (Nestle, Alaska), full cream milk, condensed milk (Nestle), evaporated milk, oat milk, almond milk, non-dairy creamer (Coffee Mate, Kremil-S), all-purpose cream, whipped cream powder, cocoa powder (Hershey's, Milo), Ovaltine, black tapioca pearls, crystal boba, popping boba, grass jelly, nata de coco, strawberry bits, lychee, washed sugar, brown sugar, ice cubes
Packaging Materials: 16oz hot cup, 22oz cold cup, paper cup, PET plastic cup, flat lid, dome lid, fat straw, paper straw, cup sleeve, cup carrier/tray, kraft paper bag, sando bag
Equipment: Breville/De'Longhi/La Marzocco espresso machine, Mahlkonig/Eureka/Mazzer grinder, Vitamix/Ninja blender, cup sealer machine, cup sealer film, refrigerator, display chiller, ice maker
Store Supplies: Tamper, portafilter, milk pitcher, barista thermometer, latte art pen, cleaning brush, grouphead brush, descaler, espresso machine cleaning tablet
Utilities: Meralco, Maynilad, PLDT/Converge/Globe internet, Gasul LPG (if gas equipment)
Transportation: Lalamove, GrabExpress, J&T`;

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
- "Weighing scale" → "Equipment"

CROSS-BUSINESS DISAMBIGUATION — in this Sari-Sari Store:
- Rice, sugar, salt, oil, noodles → "Merchandise Inventory" (you SELL these, not use them)
- Unlike a Food Business where oil is Raw Materials, HERE oil is Merchandise Inventory
- Plastic bags for customers → "Packaging Materials"
- Soap/shampoo → "Merchandise Inventory" (sold to customers)

PHILIPPINE BRAND/PRODUCT QUICK-REFERENCE:
Merchandise Inventory: Sinandomeng/Dinorado rice, refined sugar, iodized salt, Datu Puti soy sauce/vinegar, Minola/Golden Fiesta cooking oil, Lucky Me noodles, Payless noodles, Century Tuna, Mega Sardines, Argentina sardines, Spam, corned beef, Yan Yan, Chippy, Piattos, Oishi, Skyflakes, Hansel, Rebisco, Coca-Cola, Pepsi, Royal, Sprite, C2, Nature Spring, Absolute water, Milo sachet, Nescafe sachet, Kopiko Black, Great Taste, Bear Brand powdered milk, Alaska powdered milk, Marlboro, Philip Morris, Fortune cigarette, Palmolive, Head & Shoulders, Safeguard, Dove, Colgate, Close Up, Sensitive, Good morning soap, Rejoice shampoo, Knorr cube, Maggi savor, Mama Sita, boy bawang, Boy Bawang, V-Cut, Chiz Curl
Packaging Materials: Sando bag, plastic bag, ordinary tie bag
Equipment: Weighing scale, steel cabinet, small refrigerator
Utilities: Meralco, water bill

⚠️ STRICT ENFORCEMENT: Use ONLY the categories listed at the top. Do NOT use "Bank Charges", "Insurance", "Licenses & Permits", or any other category not explicitly listed. If an item doesn't clearly fit the listed categories, use "General".`;

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
- Paper in Office Supply Store → Merchandise Inventory (sold as product)

PHILIPPINE CONTEXT: Common brands/providers:
Utilities: Meralco (electricity), Maynilad/Manila Water (water), PLDT/Converge/Globe/Sky (internet)
Transportation: Petron/Shell/Caltex/Seaoil (fuel), Lalamove/GrabExpress/J&T/Flash/LBC (courier)
General: If unsure, use "General" rather than guessing wrong.

⚠️ STRICT ENFORCEMENT: Use ONLY the categories listed at the top. Do NOT use "Bank Charges", "Insurance", "Licenses & Permits", "Security Services", or any other category not explicitly listed. If an item doesn't clearly fit the listed categories, use "General".`;
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
