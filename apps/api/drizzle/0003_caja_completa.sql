CREATE TYPE "public"."movimiento_caja" AS ENUM('BASE', 'GASTO');--> statement-breakpoint
CREATE TABLE "cierres_caja" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"dia" date NOT NULL,
	"esperado" integer NOT NULL,
	"contado" integer NOT NULL,
	"nota" text,
	"usuario_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cierres_contado_valido" CHECK ("cierres_caja"."contado" >= 0)
);
--> statement-breakpoint
CREATE TABLE "movimientos_caja" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"dia" date NOT NULL,
	"tipo" "movimiento_caja" NOT NULL,
	"monto" integer NOT NULL,
	"descripcion" text,
	"usuario_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_monto_valido" CHECK ("movimientos_caja"."monto" >= 0 AND ("movimientos_caja"."tipo" = 'BASE' OR "movimientos_caja"."monto" > 0)),
	CONSTRAINT "movimientos_gasto_con_descripcion" CHECK ("movimientos_caja"."tipo" = 'BASE' OR "movimientos_caja"."descripcion" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_tienda_id_tiendas_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tiendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_tienda_id_tiendas_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tiendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cierres_uno_por_dia" ON "cierres_caja" USING btree ("tienda_id","dia");--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_una_base_por_dia" ON "movimientos_caja" USING btree ("tienda_id","dia") WHERE "movimientos_caja"."tipo" = 'BASE';--> statement-breakpoint
CREATE INDEX "movimientos_tienda_dia_idx" ON "movimientos_caja" USING btree ("tienda_id","dia");