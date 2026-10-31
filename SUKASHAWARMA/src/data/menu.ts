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
  "minuman",
];

export const menuItems: MenuItem[] = [
  // ─── ORIGINAL SHAWARMA AYAM ──────────────────────────────────────────────
  {
    id: "ori-ayam-besar",
    name: "Original Ayam Besar",
    category: "original-shawarma-ayam",
    description: "Shawarma ayam ukuran besar — lebih banyak lebih puas",
    price: 31000,
    image: "/menus/SS_ORI_AYAM_01.jpg",
    isBestSeller: true,
  },
  {
    id: "ori-ayam-sedang",
    name: "Original Ayam Sedang",
    category: "original-shawarma-ayam",
    description: "Shawarma ayam ukuran sedang dengan bumbu rempah khas SUKA",
    price: 26000,
    image: "/menus/SS_ORI_AYAM_01.jpg",
  },
  {
    id: "ori-ayam-jumbo",
    name: "Original Ayam Jumbo",
    category: "original-shawarma-ayam",
    description: "Shawarma ayam ukuran jumbo untuk porsi ekstra",
    price: 36000,
    image: "/menus/SS_ORI_AYAM_01.jpg",
  },

  // ─── ORIGINAL SHAWARMA SAPI ──────────────────────────────────────────────
  {
    id: "ori-sapi-besar",
    name: "Original Sapi Besar",
    category: "original-shawarma-sapi",
    description: "Shawarma daging sapi pilihan ukuran besar",
    price: 34000,
    image: "/menus/SS_ORI_SAPI_01.jpg",
    isBestSeller: true,
  },
  {
    id: "ori-sapi-jumbo",
    name: "Original Sapi Jumbo",
    category: "original-shawarma-sapi",
    description: "Shawarma daging sapi pilihan ukuran jumbo",
    price: 44000,
    image: "/menus/SS_ORI_SAPI_01.jpg",
  },
  {
    id: "ori-sapi-sedang",
    name: "Original Sapi Sedang",
    category: "original-shawarma-sapi",
    description: "Shawarma daging sapi pilihan ukuran sedang",
    price: 29000,
    image: "/menus/SS_ORI_SAPI_01.jpg",
  },

  // ─── ORIGINAL SHAWARMA MIX ───────────────────────────────────────────────
  {
    id: "ori-mix-besar",
    name: "Original Mix Besar",
    category: "original-shawarma-mix",
    description: "Perpaduan ayam dan sapi dalam satu wrap ukuran besar",
    price: 39000,
    image: "/menus/SS_ORI_MIX_01.jpg",
  },
  {
    id: "ori-mix-jumbo",
    name: "Original Mix Jumbo",
    category: "original-shawarma-mix",
    description: "Perpaduan ayam dan sapi dalam satu wrap ukuran jumbo",
    price: 49000,
    image: "/menus/SS_ORI_MIX_01.jpg",
  },

  // ─── SUKA SUKA ───────────────────────────────────────────────────────────
  {
    id: "suka-chicken",
    name: "Suka Chicken",
    category: "suka-suka",
    description: "Shawarma ayam spesial dengan saus SUKA signature",
    price: 31000,
    image: "/menus/SS_SUKA_CHICKEN_01.jpg",
    isBestSeller: true,
  },
  {
    id: "suka-beef",
    name: "Suka Beef",
    category: "suka-suka",
    description: "Shawarma sapi spesial dengan saus SUKA signature",
    price: 34000,
    image: "/menus/SS_SUKA_BEEF_01.jpg",
  },
  {
    id: "suka-fried-chicken",
    name: "Suka Fried Chicken",
    category: "suka-suka",
    description: "Shawarma ayam goreng crispy dengan saus SUKA signature",
    price: 32000,
    image: "/menus/SS_SUKA_FRIED_CHICKEN_01.jpg",
  },
  {
    id: "suka-samyang",
    name: "Suka Samyang",
    category: "suka-suka",
    description: "Shawarma pedas level Samyang — buat yang suka tantangan",
    price: 32000,
    image: "/menus/SS_SUKA_SAMYANG_01.jpg",
  },
  {
    id: "suka-sausage",
    name: "Suka Sausage",
    category: "suka-suka",
    description: "Shawarma sosis lezat dengan saus SUKA signature",
    price: 25000,
    image: "/menus/SS_SUKA_BEEF_01.jpg",
  },


  // ─── MINUMAN ─────────────────────────────────────────────────────────────
  {
    id: "es-tea",
    name: "Es Tea",
    category: "minuman",
    description: undefined,
    price: 8000,
    image: "/menus/ES TEA.png",
  },
  {
    id: "orange-juice",
    name: "Orange Juice",
    category: "minuman",
    description: undefined,
    price: 8000,
    image: "/menus/ORANGE.png",
  },
];

// ─── Best Seller items (derived — source of truth stays above) ───────────────
export const bestSellerItems = menuItems.filter((item) => item.isBestSeller);
