ALTER TABLE "admins" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "item_variants" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "deleted_at" timestamp;