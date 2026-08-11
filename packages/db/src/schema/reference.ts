import { pgTable, text, uuid } from "drizzle-orm/pg-core";

/**
 * Reference data: Provinces, the four Clusters, the forty-two Schools.
 *
 * Seeded once by `seed/reference-data.sql` and never edited in the app —
 * `docs/product.md` is explicit that there are no admin screens for any of it.
 */

/**
 * Only the Provinces the Programme reaches, not all thirty-eight of Indonesia's.
 * A table rather than a text column for one reason: *provinces covered* is a
 * headline figure on the portfolio site, and a typo in free text would silently
 * inflate the one number nobody would think to check.
 */
export const province = pgTable("province", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
});

/**
 * Four of them, at 6 / 17 / 11 / 8 Schools. The sizes are lopsided, so nothing
 * should assume they are comparable.
 *
 * `topic` and `problem` are columns rather than tables: each Cluster carries
 * exactly one of each and each Cluster's is different, so there is nothing to
 * share and nothing to join.
 */
export const cluster = pgTable("cluster", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  topic: text("topic").notNull(),
  problem: text("problem").notNull(),
});

/**
 * `clusterId` is NOT NULL — Clusters are allocated, so "a School with no Cluster"
 * is not a state the coverage view ever has to render, and no Cluster join is
 * ever an outer join.
 *
 * `kabupatenKota` is plain text, unlike Province: nothing counts it, so a typo
 * costs a misspelt line rather than a wrong headline. It is kept because six
 * Schools are in Jakarta and three in Banda Aceh.
 */
export const school = pgTable("school", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  clusterId: uuid("cluster_id")
    .notNull()
    .references(() => cluster.id),
  provinceCode: text("province_code")
    .notNull()
    .references(() => province.code),
  kabupatenKota: text("kabupaten_kota").notNull(),
});
