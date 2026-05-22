ALTER TABLE "team_discussion_participants" DROP CONSTRAINT "team_discussion_participants_discussion_id_team_discussions_id_";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "team_discussion_participants" ADD CONSTRAINT "team_discussion_participants_discussion_id_team_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."team_discussions"("id") ON DELETE cascade ON UPDATE no action;