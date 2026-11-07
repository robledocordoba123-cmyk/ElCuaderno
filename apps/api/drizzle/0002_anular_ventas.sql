ALTER TABLE "ventas" ADD COLUMN "anulada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "anulada_por" integer;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_anulada_por_usuarios_id_fk" FOREIGN KEY ("anulada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_anulacion_completa" CHECK (("ventas"."anulada_en" IS NULL) = ("ventas"."anulada_por" IS NULL) AND ("ventas"."anulada_en" IS NULL) = ("ventas"."motivo_anulacion" IS NULL));