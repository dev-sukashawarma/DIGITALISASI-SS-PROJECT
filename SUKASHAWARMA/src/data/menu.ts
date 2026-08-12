// ─── Menu Data — SukaShawarma ─────────────────────────────────────────────────
// Fields marked TODO need to be filled manually by the client.

export type MenuCategory =
  | "best-seller"
  | "original-shawarma-ayam"
  | "original-shawarma-sapi"
  | "original-shawarma-mix"
  | "suka-suka"
  | "shawarmie"
  | "minuman";

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  description?: string;  // TODO if empty
  price?: number;        // TODO if empty — in IDR
  image: string;
  isBestSeller?: boolean;
}

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  "best-seller":            "Best Seller",
  "original-shawarma-ayam": "Original Shawarma Ayam",
  "original-shawarma-sapi": "Original Shawarma Sapi",
  "original-shawarma-mix":  "Original Shawarma Mix",
  "suka-suka":              "Suka Suka",
  "shawarmie":              "Shawarmie",
  "minuman":                "Minuman",
};

export const CATEGORY_ORDER: MenuCategory[] = [
  "best-seller",
  "original-shawarma-ayam",
  "original-shawarma-sapi",
  "original-shawarma-mix",
  "suka-suka",
  "shawarmie",
  "minuman",
];

export const menuItems: MenuItem[] = [
  // ─── ORIGINAL SHAWARMA AYAM ──────────────────────────────────────────────
  {
    id: "ori-ayam-besar",
    name: "Original Ayam Besar",
    category: "original-shawarma-ayam",
    description: "Shawarma ayam ukuran besar — lebih banyak lebih puas",
    price: undefined,
    image: "/menus/SS_ORI_AYAM.png",
    isBestSeller: true,
  },
  {
    id: "ori-ayam-sedang",
    name: "Original Ayam Sedang",
    category: "original-shawarma-ayam",
    description: "Shawarma ayam ukuran sedang dengan bumbu rempah khas SUKA",
    price: undefined,
    image: "/menus/ORI AYAM.png",
  },
  {
    id: "ori-ayam-jumbo",
    name: "Original Ayam Jumbo",
    category: "original-shawarma-ayam",
    description: "Shawarma ayam ukuran jumbo untuk porsi ekstra",
    price: undefined,
    image: "/menus/ORI AYAM.png",
  },

  // ─── ORIGINAL SHAWARMA SAPI ──────────────────────────────────────────────
  {
    id: "ori-sapi-besar",
    name: "Original Sapi Besar",
    category: "original-shawarma-sapi",
    description: "Shawarma daging sapi pilihan ukuran besar",
    price: undefined,
    image: "/menus/ORI SAPI.png",
    isBestSeller: true,
  },
  {
    id: "ori-sapi-jumbo",
    name: "Original Sapi Jumbo",
    category: "original-shawarma-sapi",
    description: "Shawarma daging sapi pilihan ukuran jumbo",
    price: undefined,
    image: "/menus/ORI SAPI.png",
  },
  {
    id: "ori-sapi-sedang",
    name: "Original Sapi Sedang",
    category: "original-shawarma-sapi",
    description: "Shawarma daging sapi pilihan ukuran sedang",
    price: undefined,
    image: "/menus/ORI SAPI.png",
  },

  // ─── ORIGINAL SHAWARMA MIX ───────────────────────────────────────────────
  {
    id: "ori-mix-besar",
    name: "Original Mix Besar",
    category: "original-shawarma-mix",
    description: "Perpaduan ayam dan sapi dalam satu wrap ukuran besar",
    price: undefined,
    image: "/menus/ORI SHAWARMA MIX.png",
  },
  {
    id: "ori-mix-jumbo",
    name: "Original Mix Jumbo",
    category: "original-shawarma-mix",
    description: "Perpaduan ayam dan sapi dalam satu wrap ukuran jumbo",
    price: undefined,
    image: "/menus/ORI SHAWARMA MIX.png",
  },

  // ─── SUKA SUKA ───────────────────────────────────────────────────────────
  {
    id: "suka-chicken",
    name: "Suka Chicken",
    category: "suka-suka",
    description: "Shawarma ayam spesial dengan saus SUKA signature",
    price: undefined,
    image: "/menus/SS_SUKA_CHICKEN.png",
    isBestSeller: true,
  },
  {
    id: "suka-beef",
    name: "Suka Beef",
    category: "suka-suka",
    description: "Shawarma sapi spesial dengan saus SUKA signature",
    price: undefined,
    image: "/menus/SS_SUKA_BEEF.png",
  },
  {
    id: "suka-fried-chicken",
    name: "Suka Fried Chicken",
    category: "suka-suka",
    description: "Shawarma ayam goreng crispy dengan saus SUKA signature",
    price: undefined,
    image: "/menus/SS_SUKA_FRIED_CHICKEN.png",
  },
  {
    id: "suka-samyang",
    name: "Suka Samyang",
    category: "suka-suka",
    description: "Shawarma pedas level Samyang — buat yang suka tantangan",
    price: undefined,
    image: "/menus/SS_SUKA_SAMYANG.png",
  },

  // ─── SHAWARMIE ───────────────────────────────────────────────────────────
  {
    id: "shawarmie-ayam",
    name: "Shawarmie Ayam",
    category: "shawarmie",
    description: "Shawarma ayam disajikan dengan mie — perpaduan unik",
    price: undefined,
    image: "/menus/SS_SHAWARMIE_AYAM.png",
  },
  {
    id: "shawarmie-sapi",
    name: "Shawarmie Sapi",
    category: "shawarmie",
    description: "Shawarma sapi disajikan dengan mie — perpaduan unik",
    price: undefined,
    image: "/menus/SS_SHAWARMIE_SAPI.png",
  },

  // ─── MINUMAN ─────────────────────────────────────────────────────────────
  {
    id: "es-tea",
    name: "Es Tea",
    category: "minuman",
    description: undefined,
    price: undefined,
    image: "/menus/ES TEA.png",
  },
  {
    id: "orange-juice",
    name: "Orange Juice",
    category: "minuman",
    description: undefined,
    price: undefined,
    image: "/menus/ORANGE.png",
  },
];

// ─── Best Seller items (derived — source of truth stays above) ───────────────
export const bestSellerItems = menuItems.filter((item) => item.isBestSeller);
