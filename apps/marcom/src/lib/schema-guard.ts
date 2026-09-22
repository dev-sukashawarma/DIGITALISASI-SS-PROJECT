/**
 * Idempotent schema guard.
 *
 * Kenapa ada: DB produksi (Coolify Postgres) menyimpang dari
 * `prisma/schema.prisma` — sebagian objek dibuat lewat `prisma db push`, sebagian
 * lewat `migrate deploy`, sehingga `_prisma_migrations` tidak lagi mewakili
 * keadaan nyata dan `migrate deploy` bisa berhenti / di-skip tanpa menutup drift.
 * (Bukti: `threads_url`, `endorsement_posts`, `outlet_budgets`, `payment_date`
 * ada di schema tapi NOL file migration-nya.)
 *
 * Begitu Prisma Client menanyakan kolom yang belum ada (mis. `kols.facebook_url`),
 * SETIAP Server Component yang menyentuh tabel itu melempar → halaman balas 500
 * ("An error occurred in the Server Components render", React #441).
 *
 * Semua pernyataan di bawah WAJIB idempoten (IF NOT EXISTS / cek pg_constraint)
 * dan dijalankan satu per satu, supaya satu kegagalan tidak membatalkan sisanya.
 * Sumber: `prisma migrate diff --from-empty --to-schema-datamodel`.
 */

const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS "outlets" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "outlet_budgets" (
    "id" BIGSERIAL NOT NULL,
    "outlet_id" BIGINT NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outlet_budgets_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "kols" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kols_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "endorsements" (
    "id" BIGSERIAL NOT NULL,
    "kol_id" BIGINT NOT NULL,
    "outlet_id" BIGINT NOT NULL,
    "schedule_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "endorsement_posts" (
    "id" BIGSERIAL NOT NULL,
    "endorsement_id" BIGINT NOT NULL,
    "post_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "endorsement_posts_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "ads" (
    "id" BIGSERIAL NOT NULL,
    "outlet_id" BIGINT,
    "schedule_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "promo_events" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promo_events_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "internal_contents" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "post_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_contents_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "marcom_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marcom_settings_pkey" PRIMARY KEY ("key")
  )`,
]

/** [tabel, kolom, tipe + default] — setiap kolom non-PK dari schema.prisma. */
const COLUMNS: Array<[string, string, string]> = [
  ['outlets', 'type', `TEXT NOT NULL DEFAULT 'INTERNAL'`],
  ['outlets', 'pos_outlet_id', 'TEXT'],
  ['outlets', 'pos_name', 'TEXT'],
  ['outlets', 'pos_type', 'TEXT'],
  ['outlets', 'region', 'TEXT'],
  ['outlets', 'address', 'TEXT'],
  ['outlets', 'phone', 'TEXT'],
  ['outlets', 'is_active', 'BOOLEAN NOT NULL DEFAULT true'],

  ['outlet_budgets', 'target_budget', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ['outlet_budgets', 'target_kol_count', 'INTEGER NOT NULL DEFAULT 0'],
  ['outlet_budgets', 'notes', 'TEXT'],

  ['kols', 'tiktok_url', 'TEXT'],
  ['kols', 'instagram_url', 'TEXT'],
  ['kols', 'youtube_url', 'TEXT'],
  ['kols', 'facebook_url', 'TEXT'],
  ['kols', 'threads_url', 'TEXT'],
  ['kols', 'phone_number', 'TEXT'],
  ['kols', 'bank_account', 'TEXT'],

  ['endorsements', 'rate_card', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ['endorsements', 'menu_given', 'TEXT'],
  ['endorsements', 'menu_items', 'JSONB'],
  ['endorsements', 'hpp_menu', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ['endorsements', 'pos_order_id', 'TEXT'],
  ['endorsements', 'pos_order_number', 'INTEGER'],
  ['endorsements', 'post_url', 'TEXT'],
  ['endorsements', 'initial_views', 'INTEGER'],
  ['endorsements', 'final_views', 'INTEGER'],
  ['endorsements', 'likes', 'INTEGER DEFAULT 0'],
  ['endorsements', 'comments', 'INTEGER DEFAULT 0'],
  ['endorsements', 'shares', 'INTEGER DEFAULT 0'],
  ['endorsements', 'saves', 'INTEGER DEFAULT 0'],
  ['endorsements', 'visit_status', `TEXT NOT NULL DEFAULT 'PENDING'`],
  ['endorsements', 'post_status', `TEXT NOT NULL DEFAULT 'OFF'`],
  ['endorsements', 'draft_status', `TEXT NOT NULL DEFAULT 'PENDING'`],
  ['endorsements', 'payment_status', `TEXT NOT NULL DEFAULT 'UNPAID'`],
  ['endorsements', 'payment_date', 'DATE'],
  ['endorsements', 'payment_notes', 'TEXT'],
  ['endorsements', 'bank_account_custom', 'TEXT'],
  ['endorsements', 'type', `TEXT NOT NULL DEFAULT 'VISIT'`],
  ['endorsements', 'shipping_address', 'TEXT'],
  ['endorsements', 'recipient_name', 'TEXT'],
  ['endorsements', 'courier_resi', 'TEXT'],
  ['endorsements', 'shipping_cost', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ['endorsements', 'is_shipped', 'BOOLEAN NOT NULL DEFAULT false'],
  ['endorsements', 'shipping_date', 'DATE'],
  ['endorsements', 'rate_card_expense_id', 'TEXT'],
  ['endorsements', 'shipping_expense_id', 'TEXT'],
  ['endorsements', 'last_synced_at', 'TIMESTAMPTZ'],

  ['endorsement_posts', 'platform', `TEXT NOT NULL DEFAULT 'TIKTOK'`],
  ['endorsement_posts', 'custom_platform_name', 'TEXT'],
  ['endorsement_posts', 'status', `TEXT NOT NULL DEFAULT 'POSTED'`],
  ['endorsement_posts', 'views', 'INTEGER NOT NULL DEFAULT 0'],
  ['endorsement_posts', 'likes', 'INTEGER NOT NULL DEFAULT 0'],
  ['endorsement_posts', 'comments', 'INTEGER NOT NULL DEFAULT 0'],
  ['endorsement_posts', 'shares', 'INTEGER NOT NULL DEFAULT 0'],
  ['endorsement_posts', 'saves', 'INTEGER NOT NULL DEFAULT 0'],
  ['endorsement_posts', 'posted_at', 'DATE'],

  ['ads', 'category', `TEXT NOT NULL DEFAULT 'MITRA'`],
  ['ads', 'platform', `TEXT NOT NULL DEFAULT 'TIKTOK'`],
  ['ads', 'account_name', 'TEXT'],
  ['ads', 'budget', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ['ads', 'spent', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
  ['ads', 'ad_url', 'TEXT'],
  ['ads', 'initial_views', 'INTEGER'],
  ['ads', 'final_views', 'INTEGER'],
  ['ads', 'status', `TEXT NOT NULL DEFAULT 'OFF'`],
  ['ads', 'expense_id', 'TEXT'],

  ['users', 'name', 'TEXT'],
  ['users', 'role', `TEXT NOT NULL DEFAULT 'MARCOM'`],

  ['promo_events', 'description', 'TEXT'],
  ['promo_events', 'outlet_id', 'BIGINT'],
  ['promo_events', 'type', `TEXT NOT NULL DEFAULT 'PROMO'`],

  ['internal_contents', 'platform', `TEXT NOT NULL DEFAULT 'TIKTOK'`],
  ['internal_contents', 'pillar', `TEXT NOT NULL DEFAULT 'PROMO'`],
  ['internal_contents', 'content_type', 'TEXT'],
  ['internal_contents', 'format', `TEXT NOT NULL DEFAULT 'VIDEO'`],
  ['internal_contents', 'goal', 'TEXT'],
  ['internal_contents', 'status', `TEXT NOT NULL DEFAULT 'Sudah Posting'`],
  ['internal_contents', 'is_ads', 'BOOLEAN NOT NULL DEFAULT false'],
  ['internal_contents', 'creator', 'TEXT'],
  ['internal_contents', 'outlet_id', 'BIGINT'],
  ['internal_contents', 'post_url', 'TEXT'],
  ['internal_contents', 'post_time', 'TEXT'],
  ['internal_contents', 'reach', 'INTEGER NOT NULL DEFAULT 0'],
  ['internal_contents', 'views', 'INTEGER NOT NULL DEFAULT 0'],
  ['internal_contents', 'likes', 'INTEGER NOT NULL DEFAULT 0'],
  ['internal_contents', 'comments', 'INTEGER NOT NULL DEFAULT 0'],
  ['internal_contents', 'shares', 'INTEGER NOT NULL DEFAULT 0'],
  ['internal_contents', 'saves', 'INTEGER NOT NULL DEFAULT 0'],
  ['internal_contents', 'followers_baseline', 'INTEGER'],
  ['internal_contents', 'last_synced_at', 'TIMESTAMPTZ'],
]

const INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "outlets_name_key" ON "outlets"("name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "outlet_budgets_outlet_id_period_month_period_year_key" ON "outlet_budgets"("outlet_id", "period_month", "period_year")`,
  `CREATE INDEX IF NOT EXISTS "idx_endorsements_kol_id" ON "endorsements"("kol_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_endorsements_outlet_id" ON "endorsements"("outlet_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_endorsements_date" ON "endorsements"("schedule_date")`,
  `CREATE INDEX IF NOT EXISTS "idx_endorsements_payment_status" ON "endorsements"("payment_status")`,
  `CREATE INDEX IF NOT EXISTS "idx_endorsements_type" ON "endorsements"("type")`,
  `CREATE INDEX IF NOT EXISTS "idx_endorsement_posts_endorsement_id" ON "endorsement_posts"("endorsement_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_ads_outlet_id" ON "ads"("outlet_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_ads_category" ON "ads"("category")`,
  `CREATE INDEX IF NOT EXISTS "idx_ads_schedule_date" ON "ads"("schedule_date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email")`,
  `CREATE INDEX IF NOT EXISTS "idx_promo_events_date" ON "promo_events"("start_date", "end_date")`,
  `CREATE INDEX IF NOT EXISTS "idx_promo_events_outlet" ON "promo_events"("outlet_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_internal_content_pillar" ON "internal_contents"("pillar")`,
  `CREATE INDEX IF NOT EXISTS "idx_internal_content_platform" ON "internal_contents"("platform")`,
  `CREATE INDEX IF NOT EXISTS "idx_internal_content_type" ON "internal_contents"("content_type")`,
  `CREATE INDEX IF NOT EXISTS "idx_internal_content_format" ON "internal_contents"("format")`,
  `CREATE INDEX IF NOT EXISTS "idx_internal_content_goal" ON "internal_contents"("goal")`,
  `CREATE INDEX IF NOT EXISTS "idx_internal_content_ads" ON "internal_contents"("is_ads")`,
  `CREATE INDEX IF NOT EXISTS "idx_internal_content_date" ON "internal_contents"("post_date")`,
  `CREATE INDEX IF NOT EXISTS "idx_internal_content_outlet" ON "internal_contents"("outlet_id")`,
]

/** [nama constraint, tabel, definisi FK] */
const FOREIGN_KEYS: Array<[string, string, string]> = [
  [
    'outlet_budgets_outlet_id_fkey',
    'outlet_budgets',
    'FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE',
  ],
  [
    'endorsements_kol_id_fkey',
    'endorsements',
    'FOREIGN KEY ("kol_id") REFERENCES "kols"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
  ],
  [
    'endorsements_outlet_id_fkey',
    'endorsements',
    'FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
  ],
  [
    'endorsement_posts_endorsement_id_fkey',
    'endorsement_posts',
    'FOREIGN KEY ("endorsement_id") REFERENCES "endorsements"("id") ON DELETE CASCADE ON UPDATE CASCADE',
  ],
  [
    'ads_outlet_id_fkey',
    'ads',
    'FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE',
  ],
  [
    'promo_events_outlet_id_fkey',
    'promo_events',
    'FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE',
  ],
  [
    'internal_contents_outlet_id_fkey',
    'internal_contents',
    'FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE',
  ],
]

export function buildSchemaGuardStatements(): string[] {
  return [
    ...CREATE_TABLES,
    ...COLUMNS.map(
      ([table, column, type]) =>
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}`
    ),
    ...INDEXES,
    ...FOREIGN_KEYS.map(
      ([name, table, definition]) => `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
    ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
  END IF;
END $$`
    ),
  ]
}
