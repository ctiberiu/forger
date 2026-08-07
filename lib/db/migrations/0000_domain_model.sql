CREATE TYPE "public"."connector_kind" AS ENUM('webhook_push', 'http_pull');--> statement-breakpoint
CREATE TYPE "public"."content_item_state" AS ENUM('triggered', 'gathering', 'rendering', 'review', 'publishing', 'published', 'cancelled', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."publish_mode" AS ENUM('auto', 'assisted');--> statement-breakpoint
CREATE TYPE "public"."rendition_format" AS ENUM('feed_1x1', 'feed_4x5', 'story_9x16', 'carousel');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('instagram');--> statement-breakpoint
CREATE TABLE "asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"public_url" text NOT NULL,
	"entity_keys" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" "connector_kind" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload_schema" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"rendition_id" uuid NOT NULL,
	"slot_id" uuid,
	"signal_id" uuid,
	"entity_key" text NOT NULL,
	"state" "content_item_state" NOT NULL,
	"state_reason" text,
	"payload_snapshot" jsonb NOT NULL,
	"caption" text,
	"media_url" text,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb,
	"ig_media_id" text,
	"error" jsonb,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rendition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"format" "rendition_format" NOT NULL,
	"layout_id" text NOT NULL,
	"publish_mode" "publish_mode" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connector_id" uuid NOT NULL,
	"entity_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rrule" text NOT NULL,
	"timezone" text NOT NULL,
	"target_format" "rendition_format" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"ig_user_id" text NOT NULL,
	"page_id" text NOT NULL,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"timezone" text NOT NULL,
	"daily_cap" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"connector_id" uuid,
	"data_binding" jsonb NOT NULL,
	"condition" jsonb NOT NULL,
	"freshness_ttl_seconds" integer NOT NULL,
	"cooldown_seconds" integer NOT NULL,
	"caption" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector" ADD CONSTRAINT "connector_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_social_account_id_social_account_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_rendition_id_rendition_id_fk" FOREIGN KEY ("rendition_id") REFERENCES "public"."rendition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_slot_id_slot_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_signal_id_signal_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_attempt" ADD CONSTRAINT "publish_attempt_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_attempt" ADD CONSTRAINT "publish_attempt_content_item_id_content_item_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendition" ADD CONSTRAINT "rendition_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendition" ADD CONSTRAINT "rendition_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_connector_id_connector_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connector"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot" ADD CONSTRAINT "slot_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot" ADD CONSTRAINT "slot_social_account_id_social_account_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_candidate" ADD CONSTRAINT "slot_candidate_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_candidate" ADD CONSTRAINT "slot_candidate_slot_id_slot_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_candidate" ADD CONSTRAINT "slot_candidate_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_account" ADD CONSTRAINT "social_account_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_connector_id_connector_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connector"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_workspace_id_idx" ON "asset" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_workspace_url_idx" ON "asset" USING btree ("workspace_id","public_url");--> statement-breakpoint
CREATE INDEX "connector_workspace_id_idx" ON "connector" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_workspace_key_idx" ON "connector" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "content_item_workspace_id_idx" ON "content_item" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "content_item_state_idx" ON "content_item" USING btree ("workspace_id","state","scheduled_for");--> statement-breakpoint
CREATE INDEX "content_item_template_entity_idx" ON "content_item" USING btree ("template_id","entity_key","published_at");--> statement-breakpoint
CREATE INDEX "publish_attempt_workspace_id_idx" ON "publish_attempt" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publish_attempt_item_attempt_idx" ON "publish_attempt" USING btree ("content_item_id","attempt");--> statement-breakpoint
CREATE INDEX "publish_attempt_media_idx" ON "publish_attempt" USING btree ("ig_media_id");--> statement-breakpoint
CREATE INDEX "rendition_workspace_id_idx" ON "rendition" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rendition_template_format_idx" ON "rendition" USING btree ("template_id","format");--> statement-breakpoint
CREATE INDEX "signal_workspace_id_idx" ON "signal" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "signal_entity_key_idx" ON "signal" USING btree ("workspace_id","entity_key","fetched_at");--> statement-breakpoint
CREATE INDEX "signal_connector_idx" ON "signal" USING btree ("connector_id","fetched_at");--> statement-breakpoint
CREATE INDEX "slot_workspace_id_idx" ON "slot" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "slot_social_account_idx" ON "slot" USING btree ("social_account_id");--> statement-breakpoint
CREATE INDEX "slot_candidate_workspace_id_idx" ON "slot_candidate" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slot_candidate_slot_position_idx" ON "slot_candidate" USING btree ("slot_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "slot_candidate_slot_template_idx" ON "slot_candidate" USING btree ("slot_id","template_id");--> statement-breakpoint
CREATE INDEX "social_account_workspace_id_idx" ON "social_account" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_account_platform_user_idx" ON "social_account" USING btree ("workspace_id","platform","ig_user_id");--> statement-breakpoint
CREATE INDEX "template_workspace_id_idx" ON "template" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_workspace_key_idx" ON "template" USING btree ("workspace_id","key");