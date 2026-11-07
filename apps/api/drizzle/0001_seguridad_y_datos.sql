CREATE TABLE "bitacora" (
	"id" serial PRIMARY KEY NOT NULL,
	"tienda_id" integer NOT NULL,
	"usuario_id" integer,
	"usuario_nombre" text NOT NULL,
	"accion" text NOT NULL,
	"detalle" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "autoriza_datos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "autorizado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "suprimido_en" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "bitacora_tienda_fecha_idx" ON "bitacora" USING btree ("tienda_id","creado_en");--> statement-breakpoint
-- La bitácora no se edita ni se borra. Única excepción: la recarga de la demo, que antes
-- de borrar activa en su propia transacción la variable elcuaderno.recargar_demo.
CREATE FUNCTION bitacora_inmutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('elcuaderno.recargar_demo', true) = 'si' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'La bitácora no se puede modificar ni borrar';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER bitacora_inmutable BEFORE UPDATE OR DELETE ON "bitacora"
  FOR EACH ROW EXECUTE FUNCTION bitacora_inmutable();
