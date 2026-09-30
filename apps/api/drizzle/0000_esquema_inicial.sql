CREATE TYPE "public"."medio_de_pago" AS ENUM('EFECTIVO', 'NEQUI', 'FIADO');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('DUENO', 'CAJERO');--> statement-breakpoint
CREATE TABLE "abonos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"monto" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abonos_monto_positivo" CHECK ("abonos"."monto" > 0)
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"cupo" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "clientes_cupo_valido" CHECK ("clientes"."cupo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "detalles_venta" (
	"id" serial PRIMARY KEY NOT NULL,
	"venta_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unitario" integer NOT NULL,
	"costo_unitario" integer NOT NULL,
	CONSTRAINT "detalles_cantidad_positiva" CHECK ("detalles_venta"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"precio" integer NOT NULL,
	"costo" integer NOT NULL,
	"stock" integer NOT NULL,
	"stock_minimo" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "productos_stock_no_negativo" CHECK ("productos"."stock" >= 0),
	CONSTRAINT "productos_precio_positivo" CHECK ("productos"."precio" > 0),
	CONSTRAINT "productos_costo_valido" CHECK ("productos"."costo" >= 0 AND "productos"."costo" <= "productos"."precio")
);
--> statement-breakpoint
CREATE TABLE "tiendas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ventas" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"cliente_id" integer,
	"usuario_id" integer NOT NULL,
	"medio" "medio_de_pago" NOT NULL,
	"total" integer NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ventas_fiado_con_cliente" CHECK ("ventas"."medio" <> 'FIADO' OR "ventas"."cliente_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_tienda_id_tiendas_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tiendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tienda_id_tiendas_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tiendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_tienda_id_tiendas_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tiendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tienda_id_tiendas_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tiendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_tienda_id_tiendas_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tiendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abonos_cliente_idx" ON "abonos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "clientes_tienda_idx" ON "clientes" USING btree ("tienda_id");--> statement-breakpoint
CREATE INDEX "detalles_venta_idx" ON "detalles_venta" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "productos_tienda_idx" ON "productos" USING btree ("tienda_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_uk" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ventas_tienda_fecha_idx" ON "ventas" USING btree ("tienda_id","creada_en");