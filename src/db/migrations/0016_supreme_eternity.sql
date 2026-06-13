CREATE INDEX IF NOT EXISTS "loyalty_ledger_user_id_idx" ON "loyalty_ledger" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_items_category_id_idx" ON "menu_items" ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_user_id_idx" ON "orders" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders" ("created_at");