-- Venta a granel. Las ventas que ya existen eran por unidad: su subtotal es precio × cantidad.
ALTER TABLE "detalles_venta" ADD COLUMN "subtotal" integer;--> statement-breakpoint
ALTER TABLE "detalles_venta" ADD COLUMN "costo_total" integer;--> statement-breakpoint
UPDATE "detalles_venta" SET "subtotal" = "precio_unitario" * "cantidad", "costo_total" = "costo_unitario" * "cantidad";--> statement-breakpoint
ALTER TABLE "detalles_venta" ALTER COLUMN "subtotal" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "detalles_venta" ALTER COLUMN "costo_total" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "por_peso" boolean DEFAULT false NOT NULL;
