CREATE TABLE "entradas_inventario" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"costo_unitario" integer NOT NULL,
	"proveedor" text,
	"usuario_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entradas_cantidad_positiva" CHECK ("entradas_inventario"."cantidad" > 0),
	CONSTRAINT "entradas_costo_valido" CHECK ("entradas_inventario"."costo_unitario" >= 0)
);
--> statement-breakpoint
ALTER TABLE "entradas_inventario" ADD CONSTRAINT "entradas_inventario_tienda_id_tiendas_id_fk" FOREIGN KEY ("tienda_id") REFERENCES "public"."tiendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas_inventario" ADD CONSTRAINT "entradas_inventario_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas_inventario" ADD CONSTRAINT "entradas_inventario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entradas_producto_idx" ON "entradas_inventario" USING btree ("producto_id","creado_en");