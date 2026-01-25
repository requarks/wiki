CREATE TABLE "authentication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" varchar(255) NOT NULL,
	"isEnabled" boolean DEFAULT false NOT NULL,
	"displayName" varchar(255) DEFAULT '' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"registration" boolean DEFAULT false NOT NULL,
	"allowedEmailRegex" varchar(255) DEFAULT '' NOT NULL,
	"autoEnrollGroups" uuid[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"permissions" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"redirectOnLogin" varchar(255) DEFAULT '' NOT NULL,
	"redirectOnFirstLogin" varchar(255) DEFAULT '' NOT NULL,
	"redirectOnLogout" varchar(255) DEFAULT '' NOT NULL,
	"isSystem" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hostname" varchar(255) NOT NULL,
	"isEnabled" boolean DEFAULT false NOT NULL,
	"config" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sites_hostname_unique" UNIQUE("hostname")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"auth" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"passkeys" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hasAvatar" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	"isSystem" boolean DEFAULT false NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "lastLoginAt_idx" ON "users" USING btree ("lastLoginAt");