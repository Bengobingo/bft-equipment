CREATE INDEX `events_target_idx` ON `events` (`target`);--> statement-breakpoint
CREATE INDEX `events_actor_idx` ON `events` (`actor_id`);--> statement-breakpoint
CREATE INDEX `events_created_idx` ON `events` (`created`);--> statement-breakpoint
CREATE INDEX `loans_equipment_window_idx` ON `loans` (`equipment_id`,`status`,`start`,`end`);--> statement-breakpoint
CREATE INDEX `loans_user_idx` ON `loans` (`user_id`);--> statement-breakpoint
CREATE INDEX `loans_department_idx` ON `loans` (`department`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expires`);