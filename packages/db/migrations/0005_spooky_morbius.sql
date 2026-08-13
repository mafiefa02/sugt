CREATE TABLE "story" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"school_id" uuid NOT NULL,
	"stream" text,
	"kind" text DEFAULT 'field' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"cover_photo_id" uuid,
	"published_at" timestamp with time zone,
	"written_by_person_id" uuid NOT NULL,
	"written_by_role" text DEFAULT 'Staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_slug_unique" UNIQUE("slug"),
	CONSTRAINT "story_stream_check" CHECK ("story"."stream" in ('STEM', 'Research')),
	CONSTRAINT "story_kind_check" CHECK ("story"."kind" in ('field', 'final_project')),
	CONSTRAINT "story_written_by_role_check" CHECK ("story"."written_by_role" = 'Staff')
);
--> statement-breakpoint
CREATE TABLE "story_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"caption" text,
	"uploaded_by_person_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_photo_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_cover_photo_id_story_photo_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."story_photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_written_by_staff" FOREIGN KEY ("written_by_person_id","written_by_role") REFERENCES "public"."person"("id","role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_photo" ADD CONSTRAINT "story_photo_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_photo" ADD CONSTRAINT "story_photo_uploaded_by_person_id_person_id_fk" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;