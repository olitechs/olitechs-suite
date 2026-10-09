/**
 * Version 1 sample data — OliTechs PMS + POS.
 *
 * Realistic Kenyan property data in KES. Every number rendered by the UI is
 * derived from these records (prices, tax rules, shift float, tables) — the
 * components never hardcode amounts.
 */

export const PROPERTY = {
  name: "Acacia Ridge Hotel",
  city: "Nairobi, Kenya",
  currency: "KES",
  timezone: "Africa/Nairobi",
  /** Property setting: does displayed price include tax or get taxed on top? */
  taxInclusive: true,
  taxRules: [
    { id: "vat", name: "VAT", rate: 0.16 },
    { id: "levy", name: "Tourism Levy", rate: 0.02 },
  ],
  /** Manager PIN used to approve voids / large discounts in this prototype. */
  managerPin: "1234",
} as const;

export type TaxRule = (typeof PROPERTY.taxRules)[number];

/* ------------------------------------------------------------------ menu */

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  /** Minimum number of choices — >= 1 makes the group required. */
  min: number;
  max: number;
  /** Show the Less / Normal / More segmented control on each option. */
  allowPrep?: boolean;
  options: ModifierOption[];
}

export type Department = "Kitchen" | "Bar";

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  /** Size / variant shown next to the name so SKUs stay unique. */
  variant?: string;
  /** KES, tax rules applied by computeTotals per PROPERTY.taxInclusive. */
  price: number;
  category: string;
  dept: Department;
  modifierGroupIds: string[];
}

export const CATEGORIES = [
  "Starters",
  "Mains",
  "Grill",
  "Sides",
  "Desserts",
  "Soft drinks",
  "Beer & wine",
  "Hot drinks",
] as const;

export const MODIFIER_GROUPS: ModifierGroup[] = [
  {
    id: "spice",
    name: "Spice level",
    min: 1,
    max: 1,
    options: [
      { id: "mild", name: "Mild", price: 0 },
      { id: "medium", name: "Medium", price: 0 },
      { id: "hot", name: "Hot", price: 0 },
    ],
  },
  {
    id: "masala-add",
    name: "Add to chips",
    min: 0,
    max: 3,
    options: [
      { id: "extra-masala", name: "Extra masala", price: 100 },
      { id: "cheese", name: "Cheese", price: 120 },
      { id: "fried-egg", name: "Fried egg", price: 100 },
    ],
  },
  {
    id: "serve-with",
    name: "Served with",
    min: 1,
    max: 1,
    options: [
      { id: "ugali", name: "Ugali", price: 0 },
      { id: "chips", name: "Chips", price: 0 },
      { id: "rice", name: "Pilau rice", price: 0 },
    ],
  },
  {
    id: "seasoning",
    name: "Seasoning",
    min: 0,
    max: 3,
    allowPrep: true,
    options: [
      { id: "salt", name: "Salt", price: 0 },
      { id: "pepper", name: "Black pepper", price: 0 },
      { id: "gravy", name: "Gravy", price: 150 },
    ],
  },
];

const GROUP = Object.fromEntries(
  MODIFIER_GROUPS.map((g) => [g.id, g.id]),
) as Record<string, string>;

export const PRODUCTS: Product[] = [
  // Starters
  {
    id: "p-samosa",
    sku: "K-101",
    name: "Samosa",
    variant: "3 pc",
    price: 250,
    category: "Starters",
    dept: "Kitchen",
    modifierGroupIds: [],
  },
  {
    id: "p-mahamri",
    sku: "K-102",
    name: "Mahamri",
    variant: "2 pc",
    price: 220,
    category: "Starters",
    dept: "Kitchen",
    modifierGroupIds: [],
  },
  {
    id: "p-kachumbari",
    sku: "K-103",
    name: "Kachumbari Salad",
    price: 320,
    category: "Starters",
    dept: "Kitchen",
    modifierGroupIds: [],
  },
  {
    id: "p-soup",
    sku: "K-104",
    name: "Groundnut Soup",
    price: 380,
    category: "Starters",
    dept: "Kitchen",
    modifierGroupIds: [GROUP["spice"]],
  },

  // Mains
  {
    id: "p-beef-stew",
    sku: "K-201",
    name: "Beef Stew & Rice",
    price: 720,
    category: "Mains",
    dept: "Kitchen",
    modifierGroupIds: [GROUP["spice"]],
  },
  {
    id: "p-chicken-half",
    sku: "K-202",
    name: "Chicken Curry",
    variant: "Half",
    price: 780,
    category: "Mains",
    dept: "Kitchen",
    modifierGroupIds: [GROUP["spice"]],
  },
  {
    id: "p-chicken-full",
    sku: "K-203",
    name: "Chicken Curry",
    variant: "Full",
    price: 1350,
    category: "Mains",
    dept: "Kitchen",
    modifierGroupIds: [GROUP["spice"]],
  },
  {
    id: "p-ugali-nyama",
    sku: "K-204",
    name: "Ugali Nyama",
    price: 650,
    category: "Mains",
    dept: "Kitchen",
    modifierGroupIds: [],
  },
  {
    id: "p-pilau",
    sku: "K-205",
    name: "Pilau Rice",
    price: 350,
    category: "Mains",
    dept: "Kitchen",
    modifierGroupIds: [],
  },
  {
    id: "p-matoke",
    sku: "K-206",
    name: "Matoke Beef",
    price: 680,
    category: "Mains",
    dept: "Kitchen",
    modifierGroupIds: [],
  },

  // Grill
  {
    id: "p-nyama",
    sku: "K-301",
    name: "Nyama Choma Platter",
    price: 1850,
    category: "Grill",
    dept: "Kitchen",
    modifierGroupIds: [GROUP["serve-with"], GROUP["seasoning"]],
  },
  {
    id: "p-fish",
    sku: "K-302",
    name: "Lake Fish Fry",
    price: 1250,
    category: "Grill",
    dept: "Kitchen",
    modifierGroupIds: [GROUP["serve-with"], GROUP["seasoning"]],
  },
  {
    id: "p-roast-chicken",
    sku: "K-303",
    name: "Roast Chicken Quarter",
    price: 690,
    category: "Grill",
    dept: "Kitchen",
    modifierGroupIds: [GROUP["seasoning"]],
  },

  // Sides
  {
    id: "p-chips-reg",
    sku: "K-401",
    barcode: "20000000401",
    name: "Chips",
    variant: "Regular",
    price: 380,
    category: "Sides",
    dept: "Kitchen",
    modifierGroupIds: [],
  },
  {
    id: "p-chips-large",
    sku: "K-402",
    name: "Chips",
    variant: "Large",
    price: 520,
    category: "Sides",
    dept: "Kitchen",
    modifierGroupIds: [],
  },
  {
    id: "p-chips-masala-reg",
    sku: "K-403",
    barcode: "20000000403",
    name: "Chips Masala",
    variant: "Regular",
    price: 480,
    category: "Sides",
    dept: "Kitchen",
    modifierGroupIds: [GROUP["spice"], GROUP["masala-add"]],
  },
  {
    id: "p-chips-masala-large",
    sku: "K-404",
    name: "Chips Masala",
    variant: "Large",
    price: 650,
    category: "Sides",
    dept: "Kitchen",
    modifierGroupIds: [GROUP["spice"], GROUP["masala-add"]],
  },
  {
    id: "p-chapati",
    sku: "K-405",
    name: "Chapati",
    variant: "2 pc",
    price: 120,
    category: "Sides",
    dept: "Kitchen",
    modifierGroupIds: [],
  },

  // Desserts
  {
    id: "p-brownie",
    sku: "K-501",
    name: "Chocolate Brownie",
    price: 420,
    category: "Desserts",
    dept: "Kitchen",
    modifierGroupIds: [],
  },
  {
    id: "p-fruit",
    sku: "K-502",
    name: "Fresh Fruit Platter",
    price: 550,
    category: "Desserts",
    dept: "Kitchen",
    modifierGroupIds: [],
  },
  {
    id: "p-mandazi",
    sku: "K-503",
    name: "Mandazi",
    variant: "3 pc",
    price: 180,
    category: "Desserts",
    dept: "Kitchen",
    modifierGroupIds: [],
  },

  // Soft drinks
  {
    id: "p-coke",
    sku: "B-101",
    barcode: "6001240100011",
    name: "Coca-Cola",
    variant: "500 ml",
    price: 180,
    category: "Soft drinks",
    dept: "Bar",
    modifierGroupIds: [],
  },
  {
    id: "p-sprite",
    sku: "B-102",
    name: "Sprite",
    variant: "500 ml",
    price: 180,
    category: "Soft drinks",
    dept: "Bar",
    modifierGroupIds: [],
  },
  {
    id: "p-krest",
    sku: "B-103",
    name: "Krest Bitter Lemon",
    variant: "500 ml",
    price: 170,
    category: "Soft drinks",
    dept: "Bar",
    modifierGroupIds: [],
  },
  {
    id: "p-mango",
    sku: "B-104",
    barcode: "20000000104",
    name: "Fresh Mango Juice",
    price: 280,
    category: "Soft drinks",
    dept: "Bar",
    modifierGroupIds: [],
  },
  {
    id: "p-water",
    sku: "B-105",
    barcode: "6161100090016",
    name: "Keringet Water",
    variant: "500 ml",
    price: 120,
    category: "Soft drinks",
    dept: "Bar",
    modifierGroupIds: [],
  },

  // Beer & wine
  {
    id: "p-tusker",
    sku: "B-201",
    barcode: "6001028100017",
    name: "Tusker Lager",
    variant: "500 ml",
    price: 320,
    category: "Beer & wine",
    dept: "Bar",
    modifierGroupIds: [],
  },
  {
    id: "p-whitecap",
    sku: "B-202",
    name: "White Cap Hop",
    variant: "500 ml",
    price: 330,
    category: "Beer & wine",
    dept: "Bar",
    modifierGroupIds: [],
  },
  {
    id: "p-merlot-glass",
    sku: "B-203",
    name: "Merlot",
    variant: "Glass",
    price: 650,
    category: "Beer & wine",
    dept: "Bar",
    modifierGroupIds: [],
  },
  {
    id: "p-merlot-bottle",
    sku: "B-204",
    barcode: "20000000204",
    name: "Merlot",
    variant: "Bottle",
    price: 2800,
    category: "Beer & wine",
    dept: "Bar",
    modifierGroupIds: [],
  },

  // Hot drinks
  {
    id: "p-coffee",
    sku: "B-301",
    name: "Coffee",
    variant: "Cup",
    price: 220,
    category: "Hot drinks",
    dept: "Bar",
    modifierGroupIds: [],
  },
  {
    id: "p-chai",
    sku: "B-302",
    name: "Chai",
    variant: "Cup",
    price: 180,
    category: "Hot drinks",
    dept: "Bar",
    modifierGroupIds: [],
  },
];

/**
 * A price update that lands on the server while the terminal is offline.
 * On reconnect, if the ticket still holds the old price the sync layer raises
 * a conflict instead of silently rewriting money (Stage 1 flow h).
 */
export const PENDING_PRICE_UPDATE = {
  productId: "p-tusker",
  from: 320,
  to: 350,
  effectiveLabel: "14:00",
};

/* --------------------------------------------------------- floor + staff */

export type TableStatus = "free" | "occupied" | "reserved" | "bill-printed";

export interface TableRecord {
  id: string;
  name: string;
  area: string;
  seats: number;
  status: TableStatus;
  /** Minutes since the party sat (occupied tables only). */
  elapsedMin?: number;
  /** Open amount on that table's ticket, KES — shown, never added to yours. */
  amount?: number;
}

export const AREAS = [
  { id: "main", name: "Main dining" },
  { id: "terrace", name: "Terrace" },
  { id: "bar", name: "Bar counter" },
];

export const TABLES: TableRecord[] = [
  { id: "T01", name: "Table 1", area: "main", seats: 2, status: "free" },
  {
    id: "T02",
    name: "Table 2",
    area: "main",
    seats: 4,
    status: "occupied",
    elapsedMin: 25,
    amount: 2400,
  },
  { id: "T03", name: "Table 3", area: "main", seats: 4, status: "reserved" },
  {
    id: "T04",
    name: "Table 4",
    area: "main",
    seats: 6,
    status: "bill-printed",
    elapsedMin: 64,
    amount: 1320,
  },
  { id: "T05", name: "Table 5", area: "main", seats: 2, status: "free" },
  {
    id: "T06",
    name: "Table 6",
    area: "main",
    seats: 4,
    status: "occupied",
    elapsedMin: 12,
    amount: 760,
  },
  {
    id: "T12",
    name: "Table 12",
    area: "main",
    seats: 4,
    status: "occupied",
    elapsedMin: 42,
    amount: 0,
  },
  { id: "T07", name: "Table 7", area: "terrace", seats: 4, status: "free" },
  {
    id: "T08",
    name: "Table 8",
    area: "terrace",
    seats: 4,
    status: "occupied",
    elapsedMin: 8,
    amount: 640,
  },
  { id: "T09", name: "Table 9", area: "terrace", seats: 6, status: "free" },
  {
    id: "T10",
    name: "Table 10",
    area: "terrace",
    seats: 2,
    status: "reserved",
  },
  { id: "B1", name: "Bar seat 1", area: "bar", seats: 1, status: "free" },
  {
    id: "B2",
    name: "Bar seat 2",
    area: "bar",
    seats: 1,
    status: "occupied",
    elapsedMin: 35,
    amount: 960,
  },
  { id: "B3", name: "Bar seat 3", area: "bar", seats: 1, status: "free" },
  { id: "B4", name: "Bar seat 4", area: "bar", seats: 1, status: "free" },
];

export const WAITERS = [
  { id: "w-amina", name: "Amina W." },
  { id: "w-brian", name: "Brian O." },
  { id: "w-cynthia", name: "Cynthia M." },
];

export const SHIFT = {
  id: "S-018",
  operator: "Grace N.",
  operatorRole: "Front desk",
  cashier: "Peter K.",
  openingFloat: 10000,
  openedAtLabel: "06:40",
};

/** In-house rooms available for room charge (posted to the guest folio). */
export const IN_HOUSE_ROOMS = [
  { room: "214", guest: "James Otieno", folioBalance: 4200, nights: 2 },
  { room: "118", guest: "Alice Kimani", folioBalance: 0, nights: 1 },
  { room: "305", guest: "Meera Patel", folioBalance: 12750, nights: 4 },
  { room: "102", guest: "Samuel Njoroge", folioBalance: 850, nights: 1 },
  { room: "410", guest: "Wanjiku Mwangi", folioBalance: 6120, nights: 3 },
  { room: "107", guest: "Peter Ndung'u", folioBalance: 15400, nights: 2 },
];

export type OrderType = "dine-in" | "takeaway" | "delivery" | "room-service";

export const ORDER_TYPES: { id: OrderType; label: string }[] = [
  { id: "dine-in", label: "Dine-in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
  { id: "room-service", label: "Room service" },
];
