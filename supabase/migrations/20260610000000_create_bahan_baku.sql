create table bahan_baku (
  id uuid default gen_random_uuid() primary key,
  nama text not null unique,
  satuan text not null default 'pcs',
  harga_satuan integer default 0,
  stok_minimum integer default 0,
  kategori text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_bahan_baku_aktif on bahan_baku(is_active);
create index idx_bahan_baku_kategori on bahan_baku(kategori);

alter table bahan_baku enable row level security;

create policy "Bahan baku readable by all authenticated users"
  on bahan_baku for select
  using (auth.role() = 'authenticated');

create policy "Bahan baku writable by SPV only"
  on bahan_baku for insert
  with check (
    exists (
      select 1 from outlet_staff
      where outlet_staff.user_id = auth.uid()
        and outlet_staff.role = 'SPV'
    )
  );

insert into bahan_baku (nama, satuan, kategori)
values
  ('Roti Tawar Putih', 'pack', 'Roti'),
  ('Roti Tawar Cokelat', 'pack', 'Roti'),
  ('Roti Gandum', 'pack', 'Roti'),
  ('Mayones', 'botol', 'Condiments'),
  ('Sambal', 'botol', 'Condiments'),
  ('Keju Cheddar', 'kg', 'Dairy'),
  ('Daging Ayam', 'kg', 'Protein'),
  ('Daging Sapi', 'kg', 'Protein'),
  ('Telur Ayam', 'butir', 'Protein'),
  ('Tomat Segar', 'kg', 'Vegetable'),
  ('Timun Segar', 'kg', 'Vegetable'),
  ('Lettuce', 'bunch', 'Vegetable'),
  ('Bawang Merah', 'kg', 'Spice'),
  ('Bawang Putih', 'kg', 'Spice'),
  ('Lada Hitam', 'gr', 'Spice');
