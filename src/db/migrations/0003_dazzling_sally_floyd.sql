ALTER TABLE "menu_items" DROP CONSTRAINT "menu_items_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "menu_items" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
