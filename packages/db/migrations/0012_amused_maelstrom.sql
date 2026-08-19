CREATE TABLE "perjadin_preparation_item" (
	"perjadin_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"checked_by" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perjadin_preparation_item_perjadin_id_item_key_pk" PRIMARY KEY("perjadin_id","item_key")
);
--> statement-breakpoint
ALTER TABLE "perjadin_preparation_item" ADD CONSTRAINT "perjadin_preparation_item_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin_preparation_item" ADD CONSTRAINT "perjadin_preparation_item_checked_by_person_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;