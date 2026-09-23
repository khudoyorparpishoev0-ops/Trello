-- 0000_foundation — Phase 1 (§10.2, §23.7).
-- Таблицы сгенерированы drizzle-kit из src/schema. Расширение, функция и GRANT
-- drizzle-kit не выражает (R-17): они дописаны вручную до первого применения.
-- Файл forward-only: после попадания в develop-2.0 не редактируется (CI проверяет).
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
-- Технический триггер updated_at (§5.1); бизнес-логики в триггерах нет (§5.5).
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_kind" text DEFAULT 'user' NOT NULL,
	"via" text,
	"payload" jsonb NOT NULL,
	"request_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_events_actor_kind_check" CHECK ("domain_events"."actor_kind" IN ('user','system','integration')),
	CONSTRAINT "domain_events_via_check" CHECK ("domain_events"."via" IN ('web','telegram','ai','api','worker'))
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"event_id" uuid NOT NULL,
	"handler" text NOT NULL,
	"company_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "outbox_pkey" PRIMARY KEY("event_id","handler"),
	CONSTRAINT "outbox_status_check" CHECK ("outbox"."status" IN ('pending','processing','done'))
);
--> statement-breakpoint
CREATE TABLE "outbox_dead_letter" (
	"event_id" uuid NOT NULL,
	"handler" text NOT NULL,
	"company_id" uuid NOT NULL,
	"attempts" integer NOT NULL,
	"last_error" text NOT NULL,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retried_at" timestamp with time zone,
	CONSTRAINT "outbox_dead_letter_pkey" PRIMARY KEY("event_id","handler")
);
--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."domain_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_dead_letter" ADD CONSTRAINT "outbox_dead_letter_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."domain_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "domain_events_company_id_occurred_at_idx" ON "domain_events" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE INDEX "domain_events_entity_type_entity_id_occurred_at_idx" ON "domain_events" USING btree ("entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "outbox_ready" ON "outbox" USING btree ("next_attempt_at") WHERE "outbox"."status" = 'pending';
--> statement-breakpoint
-- Права. hona_app — только DML; domain_events — журнал: только INSERT и SELECT (§10.1).
GRANT USAGE ON SCHEMA public TO hona_app, hona_readonly;
--> statement-breakpoint
GRANT SELECT, INSERT ON domain_events TO hona_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON outbox, outbox_dead_letter TO hona_app;
--> statement-breakpoint
GRANT SELECT ON domain_events, outbox, outbox_dead_letter TO hona_readonly;
