CREATE TABLE "iconSets" (
	"prefix" varchar(64) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"info" jsonb DEFAULT '{}' NOT NULL,
	"refreshedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icons" (
	"prefix" varchar(64),
	"name" varchar(255),
	"body" text NOT NULL,
	"width" integer DEFAULT 16 NOT NULL,
	"height" integer DEFAULT 16 NOT NULL,
	"left" integer DEFAULT 0 NOT NULL,
	"top" integer DEFAULT 0 NOT NULL,
	"rotate" integer DEFAULT 0 NOT NULL,
	"hFlip" boolean DEFAULT false NOT NULL,
	"vFlip" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "icons_pkey" PRIMARY KEY("prefix","name")
);
--> statement-breakpoint
ALTER TABLE "icons" ADD CONSTRAINT "icons_prefix_iconSets_prefix_fkey" FOREIGN KEY ("prefix") REFERENCES "iconSets"("prefix");