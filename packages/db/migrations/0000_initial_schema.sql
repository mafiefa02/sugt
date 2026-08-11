CREATE SCHEMA "better_auth";
--> statement-breakpoint
CREATE TABLE "cluster" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"topic" text NOT NULL,
	"problem" text NOT NULL,
	CONSTRAINT "cluster_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "province" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"cluster_id" uuid NOT NULL,
	"province_code" text NOT NULL,
	"kabupaten_kota" text NOT NULL,
	CONSTRAINT "school_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_id_role_key" UNIQUE("id","role"),
	CONSTRAINT "person_role_check" CHECK ("person"."role" in ('Staff', 'Teaching Team'))
);
--> statement-breakpoint
CREATE TABLE "group_member" (
	"perjadin_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text NOT NULL,
	"stream" text,
	"receipts_settled_at" timestamp with time zone,
	CONSTRAINT "group_member_perjadin_id_person_id_pk" PRIMARY KEY("perjadin_id","person_id"),
	CONSTRAINT "group_member_role_check" CHECK ("group_member"."role" in ('Staff', 'Teaching Team')),
	CONSTRAINT "group_member_stream_check" CHECK ("group_member"."stream" in ('STEM', 'Research')),
	CONSTRAINT "group_member_stream_iff_teaching" CHECK (("group_member"."role" = 'Teaching Team') = ("group_member"."stream" is not null))
);
--> statement-breakpoint
CREATE TABLE "perjadin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"advance_idr" bigint NOT NULL,
	"pic_person_id" uuid NOT NULL,
	"pic_role" text DEFAULT 'Staff' NOT NULL,
	"returned_to_treasurer_idr" bigint,
	"returned_at" timestamp with time zone,
	"report_filed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perjadin_advance_check" CHECK ("perjadin"."advance_idr" >= 0),
	CONSTRAINT "perjadin_pic_role_check" CHECK ("perjadin"."pic_role" = 'Staff'),
	CONSTRAINT "perjadin_dates_check" CHECK ("perjadin"."ends_on" >= "perjadin"."starts_on"),
	CONSTRAINT "perjadin_returned_check" CHECK (("perjadin"."returned_at" is null) = ("perjadin"."returned_to_treasurer_idr" is null))
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"perjadin_id" uuid NOT NULL,
	"spent_on" date NOT NULL,
	"description" text NOT NULL,
	"amount_idr" bigint NOT NULL,
	"created_by_person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_amount_check" CHECK ("transaction"."amount_idr" > 0)
);
--> statement-breakpoint
CREATE TABLE "transaction_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"uploaded_by_person_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_evidence_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"perjadin_id" uuid,
	"mode" text NOT NULL,
	"held_on" date NOT NULL,
	"status" text DEFAULT 'arranged' NOT NULL,
	"cancelled_reason" text,
	"online_pic_person_id" uuid,
	"online_pic_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_mode_check" CHECK ("session"."mode" in ('offline', 'online')),
	CONSTRAINT "session_status_check" CHECK ("session"."status" in ('arranged', 'delivered', 'cancelled')),
	CONSTRAINT "session_offline_iff_perjadin" CHECK (("session"."mode" = 'offline') = ("session"."perjadin_id" is not null)),
	CONSTRAINT "session_online_iff_pic" CHECK (("session"."mode" = 'online') = ("session"."online_pic_person_id" is not null)),
	CONSTRAINT "session_online_pic_role_check" CHECK ("session"."online_pic_role" = 'Staff'),
	CONSTRAINT "session_pic_pair_check" CHECK (("session"."online_pic_person_id" is null) = ("session"."online_pic_role" is null)),
	CONSTRAINT "session_cancelled_iff_reason" CHECK (("session"."status" = 'cancelled') = ("session"."cancelled_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "session_teacher" (
	"session_id" uuid NOT NULL,
	"stream" text NOT NULL,
	"person_id" uuid NOT NULL,
	"person_role" text DEFAULT 'Teaching Team' NOT NULL,
	CONSTRAINT "session_teacher_session_id_stream_pk" PRIMARY KEY("session_id","stream"),
	CONSTRAINT "session_teacher_stream_check" CHECK ("session_teacher"."stream" in ('STEM', 'Research')),
	CONSTRAINT "session_teacher_role_check" CHECK ("session_teacher"."person_role" = 'Teaching Team')
);
--> statement-breakpoint
CREATE TABLE "class_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"class_kind" text NOT NULL,
	"filed_by_person_id" uuid NOT NULL,
	"filed_by_role" text DEFAULT 'Teaching Team' NOT NULL,
	"comprehension" smallint NOT NULL,
	"participation" smallint NOT NULL,
	"readiness" smallint NOT NULL,
	"materials" smallint NOT NULL,
	"delivery" smallint NOT NULL,
	"facilities" smallint NOT NULL,
	"timing" smallint NOT NULL,
	"covered" text,
	"problems" text,
	"suggestions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_record_one_per_filer" UNIQUE("session_id","class_kind","filed_by_person_id"),
	CONSTRAINT "class_record_class_kind_check" CHECK ("class_record"."class_kind" in ('GTK', 'MS', 'Student')),
	CONSTRAINT "class_record_filed_by_role_check" CHECK ("class_record"."filed_by_role" = 'Teaching Team'),
	CONSTRAINT "class_record_comprehension_check" CHECK ("class_record"."comprehension" between 1 and 10),
	CONSTRAINT "class_record_participation_check" CHECK ("class_record"."participation" between 1 and 10),
	CONSTRAINT "class_record_readiness_check" CHECK ("class_record"."readiness" between 1 and 10),
	CONSTRAINT "class_record_materials_check" CHECK ("class_record"."materials" between 1 and 10),
	CONSTRAINT "class_record_delivery_check" CHECK ("class_record"."delivery" between 1 and 10),
	CONSTRAINT "class_record_facilities_check" CHECK ("class_record"."facilities" between 1 and 10),
	CONSTRAINT "class_record_timing_check" CHECK ("class_record"."timing" between 1 and 10),
	CONSTRAINT "class_record_low_rating_needs_prose" CHECK (least("class_record"."comprehension", "class_record"."participation", "class_record"."readiness", "class_record"."materials",
                "class_record"."delivery", "class_record"."facilities", "class_record"."timing") > 7
          or btrim(coalesce("class_record"."problems", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "participant_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"class_kind" text NOT NULL,
	"name" text NOT NULL,
	"materials" smallint NOT NULL,
	"instructor" smallint NOT NULL,
	"relevance" smallint NOT NULL,
	"comment" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_feedback_class_kind_check" CHECK ("participant_feedback"."class_kind" in ('GTK', 'MS', 'Student')),
	CONSTRAINT "participant_feedback_materials_check" CHECK ("participant_feedback"."materials" between 1 and 10),
	CONSTRAINT "participant_feedback_instructor_check" CHECK ("participant_feedback"."instructor" between 1 and 10),
	CONSTRAINT "participant_feedback_relevance_check" CHECK ("participant_feedback"."relevance" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "perjadin_evaluation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"perjadin_id" uuid NOT NULL,
	"filed_by_person_id" uuid NOT NULL,
	"lodging" smallint NOT NULL,
	"transport" smallint NOT NULL,
	"meals" smallint NOT NULL,
	"punctuality" smallint NOT NULL,
	"problems" text,
	"suggestions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perjadin_evaluation_one_per_filer" UNIQUE("perjadin_id","filed_by_person_id"),
	CONSTRAINT "perjadin_evaluation_lodging_check" CHECK ("perjadin_evaluation"."lodging" between 1 and 10),
	CONSTRAINT "perjadin_evaluation_transport_check" CHECK ("perjadin_evaluation"."transport" between 1 and 10),
	CONSTRAINT "perjadin_evaluation_meals_check" CHECK ("perjadin_evaluation"."meals" between 1 and 10),
	CONSTRAINT "perjadin_evaluation_punctuality_check" CHECK ("perjadin_evaluation"."punctuality" between 1 and 10),
	CONSTRAINT "perjadin_evaluation_low_rating_needs_prose" CHECK (least("perjadin_evaluation"."lodging", "perjadin_evaluation"."transport", "perjadin_evaluation"."meals", "perjadin_evaluation"."punctuality") > 7
          or btrim(coalesce("perjadin_evaluation"."problems", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "session_feedback_token" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '24 hours' NOT NULL,
	"issued_by_person_id" uuid NOT NULL,
	CONSTRAINT "session_feedback_token_token_unique" UNIQUE("token"),
	CONSTRAINT "session_feedback_token_expiry_check" CHECK ("session_feedback_token"."expires_at" > "session_feedback_token"."issued_at")
);
--> statement-breakpoint
CREATE TABLE "session_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"filed_by_person_id" uuid NOT NULL,
	"filed_by_role" text DEFAULT 'Staff' NOT NULL,
	"facilities" smallint NOT NULL,
	"turnout" smallint NOT NULL,
	"school_support" smallint NOT NULL,
	"timing" smallint NOT NULL,
	"coordination" smallint NOT NULL,
	"problems" text,
	"suggestions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_record_one_per_filer" UNIQUE("session_id","filed_by_person_id"),
	CONSTRAINT "session_record_filed_by_role_check" CHECK ("session_record"."filed_by_role" = 'Staff'),
	CONSTRAINT "session_record_facilities_check" CHECK ("session_record"."facilities" between 1 and 10),
	CONSTRAINT "session_record_turnout_check" CHECK ("session_record"."turnout" between 1 and 10),
	CONSTRAINT "session_record_school_support_check" CHECK ("session_record"."school_support" between 1 and 10),
	CONSTRAINT "session_record_timing_check" CHECK ("session_record"."timing" between 1 and 10),
	CONSTRAINT "session_record_coordination_check" CHECK ("session_record"."coordination" between 1 and 10),
	CONSTRAINT "session_record_low_rating_needs_prose" CHECK (least("session_record"."facilities", "session_record"."turnout", "session_record"."school_support", "session_record"."timing", "session_record"."coordination")
            > 7
          or btrim(coalesce("session_record"."problems", '')) <> '')
);
--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_cluster_id_cluster_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."cluster"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_province_code_province_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."province"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_person_role_fk" FOREIGN KEY ("person_id","role") REFERENCES "public"."person"("id","role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin" ADD CONSTRAINT "perjadin_pic_is_staff" FOREIGN KEY ("pic_person_id","pic_role") REFERENCES "public"."person"("id","role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_created_by_person_id_person_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_evidence" ADD CONSTRAINT "transaction_evidence_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_evidence" ADD CONSTRAINT "transaction_evidence_uploaded_by_person_id_person_id_fk" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_online_pic_is_staff" FOREIGN KEY ("online_pic_person_id","online_pic_role") REFERENCES "public"."person"("id","role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_teacher" ADD CONSTRAINT "session_teacher_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_teacher" ADD CONSTRAINT "session_teacher_is_teaching_team" FOREIGN KEY ("person_id","person_role") REFERENCES "public"."person"("id","role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_record" ADD CONSTRAINT "class_record_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_record" ADD CONSTRAINT "class_record_filed_by_teaching_team" FOREIGN KEY ("filed_by_person_id","filed_by_role") REFERENCES "public"."person"("id","role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_feedback" ADD CONSTRAINT "participant_feedback_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin_evaluation" ADD CONSTRAINT "perjadin_evaluation_perjadin_id_perjadin_id_fk" FOREIGN KEY ("perjadin_id") REFERENCES "public"."perjadin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perjadin_evaluation" ADD CONSTRAINT "perjadin_evaluation_filed_by_person_id_person_id_fk" FOREIGN KEY ("filed_by_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_feedback_token" ADD CONSTRAINT "session_feedback_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_feedback_token" ADD CONSTRAINT "session_feedback_token_issued_by_person_id_person_id_fk" FOREIGN KEY ("issued_by_person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_record" ADD CONSTRAINT "session_record_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_record" ADD CONSTRAINT "session_record_filed_by_staff" FOREIGN KEY ("filed_by_person_id","filed_by_role") REFERENCES "public"."person"("id","role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_email_key" ON "person" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "session_one_per_school_per_perjadin" ON "session" USING btree ("perjadin_id","school_id") WHERE status <> 'cancelled';--> statement-breakpoint
CREATE INDEX "class_record_concerns_idx" ON "class_record" USING btree (least(comprehension, participation, readiness, materials, delivery, facilities, timing)) WHERE least(comprehension, participation, readiness, materials, delivery, facilities, timing) <= 7;--> statement-breakpoint
CREATE INDEX "participant_feedback_concerns_idx" ON "participant_feedback" USING btree (least(materials, instructor, relevance)) WHERE least(materials, instructor, relevance) <= 7;--> statement-breakpoint
CREATE INDEX "perjadin_evaluation_concerns_idx" ON "perjadin_evaluation" USING btree (least(lodging, transport, meals, punctuality)) WHERE least(lodging, transport, meals, punctuality) <= 7;--> statement-breakpoint
CREATE INDEX "session_record_concerns_idx" ON "session_record" USING btree (least(facilities, turnout, school_support, timing, coordination)) WHERE least(facilities, turnout, school_support, timing, coordination) <= 7;