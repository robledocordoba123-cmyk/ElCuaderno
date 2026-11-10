-- Equipo y registro: cajeros que se desactivan, sesiones que se pueden cerrar y tiendas nuevas.
ALTER TABLE "tiendas" ADD COLUMN "creada_en" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tiendas" ADD COLUMN "politica_aceptada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "activo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "version_sesion" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "creado_en" timestamp with time zone DEFAULT now() NOT NULL;