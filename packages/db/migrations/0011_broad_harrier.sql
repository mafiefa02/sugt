ALTER TABLE "perjadin" ADD COLUMN "departure_at" timestamp;--> statement-breakpoint
ALTER TABLE "perjadin" ADD COLUMN "departure_zone" text;--> statement-breakpoint
ALTER TABLE "perjadin" ADD COLUMN "departure_mode" text;--> statement-breakpoint
ALTER TABLE "perjadin" ADD COLUMN "return_at" timestamp;--> statement-breakpoint
ALTER TABLE "perjadin" ADD COLUMN "return_zone" text;--> statement-breakpoint
ALTER TABLE "perjadin" ADD COLUMN "return_mode" text;--> statement-breakpoint
ALTER TABLE "perjadin" ADD CONSTRAINT "perjadin_departure_zone_check" CHECK ("perjadin"."departure_zone" in ('WIB', 'WITA', 'WIT'));--> statement-breakpoint
ALTER TABLE "perjadin" ADD CONSTRAINT "perjadin_return_zone_check" CHECK ("perjadin"."return_zone" in ('WIB', 'WITA', 'WIT'));--> statement-breakpoint
ALTER TABLE "perjadin" ADD CONSTRAINT "perjadin_departure_mode_check" CHECK ("perjadin"."departure_mode" in ('Pesawat', 'Kereta', 'Travel', 'Mobil Dalam Kota'));--> statement-breakpoint
ALTER TABLE "perjadin" ADD CONSTRAINT "perjadin_return_mode_check" CHECK ("perjadin"."return_mode" in ('Pesawat', 'Kereta', 'Travel', 'Mobil Dalam Kota'));