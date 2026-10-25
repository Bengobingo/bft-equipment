ALTER TABLE `equipment` ADD `components` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `production_line` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `work_order` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `product_model` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `manifest` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `checkout_check` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `return_check` text DEFAULT '[]' NOT NULL;