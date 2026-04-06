CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`on_hand_qty` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
