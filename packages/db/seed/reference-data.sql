-- Reference data: Provinces, the four Clusters, and the forty-two Schools.
--
-- Apply with `pnpm --filter @sugt/db db:seed`, which runs it against DIRECT_URL (Supavisor
-- session mode). Run the migrations first.
--
-- This is the authored source. Schools are fixed and Clusters are allocated, so these are
-- static facts seeded once rather than records with an editing lifecycle — which is why
-- docs/product.md says there are no admin screens for any of them.
--
-- Idempotent: re-running updates in place, keyed on `slug` / `code`. Safe to apply to a
-- database that already has it.
--
-- PLACEHOLDER: the four `cluster.problem` values below are INVENTED. The source sheet gives
-- each Cluster its Topic (Isu Klaster) but not its Problem — the specific challenge drawn
-- from that Topic. They are written to be plausible for each Cluster's geography and to work
-- from both Streams, so screens and seeds have something real-shaped to render, and they are
-- wrong until DITSAMA replaces them. They are in Indonesian, matching the Topics.
--
-- To replace them: **edit the strings in this file**, not the rows in the database. Re-running
-- this seed overwrites `problem` from what is written here, exactly as it does for every other
-- column — so a Problem typed straight into the database is lost the next time anyone applies
-- the seed. That is deliberate: this file is the authored source, and one column behaving
-- differently from the rest is a worse trap than one that behaves predictably.

begin;

-- Provinces the Programme reaches. Not all thirty-eight of Indonesia's — only these are
-- referenced, and school.province_code has a foreign key here so a typo cannot inflate the
-- "provinces covered" figure on the public site.
--
-- `time_zone` is NOT NULL, so a freshly-migrated database is seeded with it here — no
-- Province straddles a boundary. Migration 0007 backfills the same values for a database
-- that was seeded before the column existed; this file is where a fresh one gets them.
insert into province (code, name, time_zone) values
  ('AC', 'Aceh', 'WIB'),
  ('SU', 'Sumatera Utara', 'WIB'),
  ('SS', 'Sumatera Selatan', 'WIB'),
  ('BT', 'Banten', 'WIB'),
  ('JK', 'DKI Jakarta', 'WIB'),
  ('JB', 'Jawa Barat', 'WIB'),
  ('JT', 'Jawa Tengah', 'WIB'),
  ('YO', 'DI Yogyakarta', 'WIB'),
  ('JI', 'Jawa Timur', 'WIB'),
  ('KI', 'Kalimantan Timur', 'WITA'),
  ('KS', 'Kalimantan Selatan', 'WITA'),
  ('GO', 'Gorontalo', 'WITA'),
  ('SN', 'Sulawesi Selatan', 'WITA'),
  ('MA', 'Maluku', 'WIT'),
  ('PD', 'Papua Barat Daya', 'WIT')
on conflict (code) do update set name = excluded.name, time_zone = excluded.time_zone;

-- The four Clusters. Sizes are lopsided on purpose — 6, 17, 11, 8 — so nothing should
-- assume they are comparable.
-- The `problem` values are PLACEHOLDERS — see the note at the top of this file.
insert into cluster (slug, name, topic, problem) values
  ('mitigasi-bencana', 'Klaster 1', 'Mitigasi Bencana',
   'Bagaimana warga sekolah membangun kesiapsiagaan dan peringatan dini bencana yang tetap berjalan tanpa bantuan dari luar pada jam-jam pertama?'),

  ('smart-city', 'Klaster 2', 'Smart City',
   'Bagaimana data lingkungan di sekitar sekolah dikumpulkan dan dipakai untuk memperbaiki mobilitas serta kualitas udara di kawasan padat?'),

  ('ketahanan-pangan', 'Klaster 3', 'Ketahanan Pangan',
   'Bagaimana pasokan pangan lokal ditingkatkan dan susut panennya ditekan tanpa menambah luas lahan?'),

  ('waste-management', 'Klaster 4', 'Waste Management',
   'Bagaimana sampah dikelola di wilayah pesisir dan kepulauan yang tidak terjangkau sistem pengangkutan terpusat?')

on conflict (slug) do update set
  name    = excluded.name,
  topic   = excluded.topic,
  -- `problem` overwrites from this file like everything else. The guard is only against a
  -- string being emptied here by accident; it does NOT protect an edit made directly in the
  -- database, which a re-run will replace. Edit above, not in the row.
  problem = case
              when btrim(excluded.problem) <> '' then excluded.problem
              else cluster.problem
            end;

-- The twenty-three Sub-Clusters, three / seven / seven / six across the four Clusters.
-- A Sub-Cluster is a set of Schools inside one Cluster reached on one journey; DITSAMA
-- invented the groupings, so they carry a Staff editing screen (Kelompok Sekolah) and
-- are seeded here as their starting state rather than as fixed facts. Names are plain
-- "Kelompok N" on purpose: the screen distinguishes them by the Schools shown beside
-- each, not by a geographic name several would share. Joined to their Cluster by slug,
-- exactly as the School block below does; the composite key on `school` then makes a
-- School's Cluster and its Sub-Cluster's Cluster unable to disagree.
insert into sub_cluster (slug, name, cluster_id)
select v.slug, v.name, c.id
from (values
  -- Klaster 1 — Mitigasi Bencana (3)
  ('kelompok-01', 'Kelompok 1', 'mitigasi-bencana'),
  ('kelompok-02', 'Kelompok 2', 'mitigasi-bencana'),
  ('kelompok-03', 'Kelompok 3', 'mitigasi-bencana'),
  -- Klaster 2 — Smart City (7)
  ('kelompok-04', 'Kelompok 4', 'smart-city'),
  ('kelompok-05', 'Kelompok 5', 'smart-city'),
  ('kelompok-06', 'Kelompok 6', 'smart-city'),
  ('kelompok-07', 'Kelompok 7', 'smart-city'),
  ('kelompok-08', 'Kelompok 8', 'smart-city'),
  ('kelompok-09', 'Kelompok 9', 'smart-city'),
  ('kelompok-10', 'Kelompok 10', 'smart-city'),
  -- Klaster 3 — Ketahanan Pangan (7)
  ('kelompok-11', 'Kelompok 11', 'ketahanan-pangan'),
  ('kelompok-12', 'Kelompok 12', 'ketahanan-pangan'),
  ('kelompok-13', 'Kelompok 13', 'ketahanan-pangan'),
  ('kelompok-14', 'Kelompok 14', 'ketahanan-pangan'),
  ('kelompok-15', 'Kelompok 15', 'ketahanan-pangan'),
  ('kelompok-16', 'Kelompok 16', 'ketahanan-pangan'),
  ('kelompok-17', 'Kelompok 17', 'ketahanan-pangan'),
  -- Klaster 4 — Waste Management (6)
  ('kelompok-18', 'Kelompok 18', 'waste-management'),
  ('kelompok-19', 'Kelompok 19', 'waste-management'),
  ('kelompok-20', 'Kelompok 20', 'waste-management'),
  ('kelompok-21', 'Kelompok 21', 'waste-management'),
  ('kelompok-22', 'Kelompok 22', 'waste-management'),
  ('kelompok-23', 'Kelompok 23', 'waste-management')
) as v (slug, name, cluster_slug)
join cluster c on c.slug = v.cluster_slug
on conflict (slug) do update set
  name       = excluded.name,
  cluster_id = excluded.cluster_id;

-- The forty-two Schools, in the order the source sheet lists them.
insert into school (slug, name, cluster_id, sub_cluster_id, province_code, kabupaten_kota)
select v.slug, v.name, c.id, sc.id, v.province_code, v.kabupaten_kota
from (values
  -- Cluster 1 — Mitigasi Bencana (6)
  ('sman-10-fajar-harapan-banda-aceh', 'SMAN 10 Fajar Harapan Banda Aceh',              'mitigasi-bencana', 'AC', 'Kota Banda Aceh', 'kelompok-01'),
  ('sma-fatih-bilingual-school',       'SMA Fatih Bilingual School',                    'mitigasi-bencana', 'AC', 'Kota Banda Aceh', 'kelompok-01'),
  ('sma-teuku-nyak-arif-fatih',        'SMA Teuku Nyak Arif Fatih Bilingual School',    'mitigasi-bencana', 'AC', 'Kota Banda Aceh', 'kelompok-01'),
  ('smas-unggul-del',                  'SMAS Unggul Del',                               'mitigasi-bencana', 'SU', 'Kab. Toba Samosir', 'kelompok-02'),
  ('man-insan-cendekia-oki',           'MAN Insan Cendekia OKI',                        'mitigasi-bencana', 'SS', 'Kab. Ogan Komering Ilir', 'kelompok-03'),
  ('sma-it-harapan-mulia',             'SMA IT Harapan Mulia',                          'mitigasi-bencana', 'SS', 'Kota Palembang', 'kelompok-03'),

  -- Cluster 2 — Smart City (17)
  ('smas-kharisma-bangsa',             'SMAS Kharisma Bangsa',                          'smart-city', 'BT', 'Kota Tangerang Selatan', 'kelompok-05'),
  ('sma-labschool-cirendeu',           'SMA Labschool Cirendeu',                        'smart-city', 'BT', 'Kota Tangerang Selatan', 'kelompok-05'),
  ('mas-ibad-ar-rahman',               'MAS Ibad Ar Rahman',                            'smart-city', 'BT', 'Kabupaten Pandeglang', 'kelompok-04'),
  ('sman-cmbbs',                       'SMAN CMBBS',                                    'smart-city', 'BT', 'Kabupaten Pandeglang', 'kelompok-04'),
  ('smanu-mh-thamrin-jakarta',         'SMANU MH. Thamrin Jakarta',                     'smart-city', 'JK', 'Jakarta Timur', 'kelompok-07'),
  ('man-4-jakarta',                    'MAN 4 Jakarta',                                 'smart-city', 'JK', 'Jakarta Selatan', 'kelompok-07'),
  ('sman-28-jakarta',                  'SMAN 28 Jakarta',                               'smart-city', 'JK', 'Jakarta Selatan', 'kelompok-07'),
  ('sma-labschool-jakarta',            'SMA Labschool Jakarta',                         'smart-city', 'JK', 'Jakarta Timur', 'kelompok-06'),
  ('sman-8-jakarta',                   'SMAN 8 Jakarta',                                'smart-city', 'JK', 'Jakarta Selatan', 'kelompok-06'),
  ('sma-labschool-kebayoran',          'SMA Labschool Kebayoran',                       'smart-city', 'JK', 'Jakarta Selatan', 'kelompok-06'),
  ('sma-cahaya-rancamaya',             'SMA Cahaya Rancamaya',                          'smart-city', 'JB', 'Kota Bogor', 'kelompok-08'),
  ('sma-pribadi-bandung',              'Sekolah Menengah Atas Pribadi Bandung',         'smart-city', 'JB', 'Kota Bandung', 'kelompok-09'),
  ('sma-islam-al-azhar-24',            'SMA Islam Al Azhar 24',                         'smart-city', 'JB', 'Kabupaten Bogor', 'kelompok-08'),
  ('sma-dwiwarna-boarding-school',     'SMA Dwiwarna Boarding School',                  'smart-city', 'JB', 'Kabupaten Bogor', 'kelompok-05'),
  ('sma-it-as-syifa-wanareja',         'SMA Islam Terpadu As-Syifa Boarding School Wanareja', 'smart-city', 'JB', 'Kabupaten Subang', 'kelompok-10'),
  ('smas-insan-cendekia-al-kausar',    'SMAS Insan Cendekia Al Kausar',                 'smart-city', 'JB', 'Kabupaten Sukabumi', 'kelompok-08'),
  ('smas-darul-hikam-internasional',   'SMAS Darul Hikam Internasional',                'smart-city', 'JB', 'Kabupaten Bandung Barat', 'kelompok-09'),

  -- Cluster 3 — Ketahanan Pangan (11)
  ('sma-pradita-dirgantara',           'SMA Pradita Dirgantara',                        'ketahanan-pangan', 'JT', 'Kabupaten Boyolali', 'kelompok-11'),
  ('sma-taruna-nusantara',             'SMA Taruna Nusantara',                          'ketahanan-pangan', 'JT', 'Kabupaten Magelang', 'kelompok-12'),
  ('sma-trensains-muhammadiyah-sragen','SMA Trensains Muhammadiyah Sragen',             'ketahanan-pangan', 'JT', 'Kabupaten Sragen', 'kelompok-11'),
  ('sma-semesta',                      'SMA Semesta',                                   'ketahanan-pangan', 'JT', 'Kota Semarang', 'kelompok-14'),
  ('sma-negeri-3-semarang',            'SMA Negeri 3 Semarang',                         'ketahanan-pangan', 'JT', 'Kota Semarang', 'kelompok-14'),
  ('sma-qt-yanbuul-quran-1',           'SMA QT Yanbuul Quran 1',                        'ketahanan-pangan', 'JT', 'Kabupaten Pati', 'kelompok-15'),
  ('sma-kesatuan-bangsa',              'Sekolah Menengah Atas Kesatuan Bangsa',         'ketahanan-pangan', 'YO', 'Kabupaten Bantul', 'kelompok-13'),
  ('sma-islam-al-azhar-9-yogyakarta',  'SMA Islam Al Azhar 9 Yogyakarta',               'ketahanan-pangan', 'YO', 'Kabupaten Sleman', 'kelompok-12'),
  ('smas-muhammadiyah-1-yogyakarta',   'SMAS Muhammadiyah 1 Yogyakarta',                'ketahanan-pangan', 'YO', 'Kota Yogyakarta', 'kelompok-13'),
  ('man-2-kota-malang',                'MAN 2 Kota Malang',                             'ketahanan-pangan', 'JI', 'Kota Malang', 'kelompok-16'),
  ('smas-al-hikmah-surabaya',          'SMAS Al Hikmah Surabaya',                       'ketahanan-pangan', 'JI', 'Kota Surabaya', 'kelompok-17'),

  -- Cluster 4 — Waste Management (8)
  ('sman-10-samarinda',                'SMAN 10 Samarinda',                             'waste-management', 'KI', 'Kota Samarinda', 'kelompok-18'),
  ('sma-nasional-kps',                 'SMA Nasional KPS',                              'waste-management', 'KI', 'Kota Balikpapan', 'kelompok-18'),
  ('sman-banua-kalsel',                'SMAN Banua Kalsel',                             'waste-management', 'KS', 'Kabupaten Banjar', 'kelompok-19'),
  ('man-insan-cendekia-gorontalo',     'MAN Insan Cendekia Gorontalo',                  'waste-management', 'GO', 'Kabupaten Bone Bolango', 'kelompok-21'),
  ('smas-golden-gate',                 'SMAS Golden Gate',                              'waste-management', 'SN', 'Kota Makassar', 'kelompok-20'),
  ('sman-5-parepare',                  'SMAN 5 Parepare',                               'waste-management', 'SN', 'Kota Parepare', 'kelompok-20'),
  ('sman-siwalima-ambon',              'SMAN Siwalima Ambon',                           'waste-management', 'MA', 'Kota Ambon', 'kelompok-22'),
  ('sma-averos',                       'SMA Averos',                                    'waste-management', 'PD', 'Kota Sorong', 'kelompok-23')
) as v (slug, name, cluster_slug, province_code, kabupaten_kota, sub_cluster_slug)
join cluster c on c.slug = v.cluster_slug
join sub_cluster sc on sc.slug = v.sub_cluster_slug
on conflict (slug) do update set
  name           = excluded.name,
  cluster_id     = excluded.cluster_id,
  sub_cluster_id = excluded.sub_cluster_id,
  province_code  = excluded.province_code,
  kabupaten_kota = excluded.kabupaten_kota;

commit;
