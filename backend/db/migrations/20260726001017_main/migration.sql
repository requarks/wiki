CREATE TYPE "hookState" AS ENUM('pending', 'success', 'error');--> statement-breakpoint
CREATE TABLE "hooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"events" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"url" text NOT NULL,
	"includeMetadata" boolean DEFAULT true NOT NULL,
	"includeContent" boolean DEFAULT false NOT NULL,
	"acceptUntrusted" boolean DEFAULT false NOT NULL,
	"authHeader" text,
	"state" "hookState" DEFAULT 'pending'::"hookState" NOT NULL,
	"lastErrorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
