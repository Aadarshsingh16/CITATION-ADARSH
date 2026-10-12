ALTER TABLE "pages" ADD COLUMN "items" jsonb;--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "file_ref";