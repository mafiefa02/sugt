-- Uang Perjalanan becomes optional when planning a Perjadin (#437). Null means "not filled in yet",
-- never Rp 0; only filing the Laporan waits for it. `perjadin_advance_check` (`advance_idr >= 0`)
-- stays and already passes for null. Existing rows keep their values; nothing is backfilled.
ALTER TABLE "perjadin" ALTER COLUMN "advance_idr" DROP NOT NULL;
