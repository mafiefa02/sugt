-- #392 (ADR-0041, superseding ADR-0021): a Perjadin carries no travel legs. Many trips are PP, so
-- one Keberangkatan and one Kepulangan with time, zone and mode describe a trip that does not exist.
-- The six leg columns and their four CHECKs go, and their data with them; accepted by the ADR.
-- starts_on / ends_on stay NOT NULL and are typed directly now; perjadin_dates_check stays.
ALTER TABLE "perjadin" DROP CONSTRAINT "perjadin_departure_zone_check";--> statement-breakpoint
ALTER TABLE "perjadin" DROP CONSTRAINT "perjadin_return_zone_check";--> statement-breakpoint
ALTER TABLE "perjadin" DROP CONSTRAINT "perjadin_departure_mode_check";--> statement-breakpoint
ALTER TABLE "perjadin" DROP CONSTRAINT "perjadin_return_mode_check";--> statement-breakpoint
ALTER TABLE "perjadin" DROP COLUMN "departure_at";--> statement-breakpoint
ALTER TABLE "perjadin" DROP COLUMN "departure_zone";--> statement-breakpoint
ALTER TABLE "perjadin" DROP COLUMN "departure_mode";--> statement-breakpoint
ALTER TABLE "perjadin" DROP COLUMN "return_at";--> statement-breakpoint
ALTER TABLE "perjadin" DROP COLUMN "return_zone";--> statement-breakpoint
ALTER TABLE "perjadin" DROP COLUMN "return_mode";