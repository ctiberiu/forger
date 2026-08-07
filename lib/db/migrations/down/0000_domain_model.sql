-- Reverse of 0000_domain_model.sql. Drizzle generates forward migrations only, so the down
-- direction is written by hand and kept beside its pair; the round trip is covered by
-- lib/db/schema.test.ts. Drop order is the reverse of the dependency order.
DROP TABLE IF EXISTS "publish_attempt";--> statement-breakpoint
DROP TABLE IF EXISTS "content_item";--> statement-breakpoint
DROP TABLE IF EXISTS "slot_candidate";--> statement-breakpoint
DROP TABLE IF EXISTS "slot";--> statement-breakpoint
DROP TABLE IF EXISTS "rendition";--> statement-breakpoint
DROP TABLE IF EXISTS "template";--> statement-breakpoint
DROP TABLE IF EXISTS "signal";--> statement-breakpoint
DROP TABLE IF EXISTS "connector";--> statement-breakpoint
DROP TABLE IF EXISTS "asset";--> statement-breakpoint
DROP TABLE IF EXISTS "social_account";--> statement-breakpoint
DROP TABLE IF EXISTS "workspace";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."content_item_state";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."publish_mode";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."rendition_format";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."connector_kind";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."social_platform";
