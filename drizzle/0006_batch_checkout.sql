CREATE TABLE checkout_batches (
 id TEXT PRIMARY KEY NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id),
 borrower_id TEXT NOT NULL REFERENCES users(id),
 production_line TEXT NOT NULL,
 payload TEXT NOT NULL,
 created TEXT NOT NULL
);
--> statement-breakpoint
ALTER TABLE loans ADD COLUMN checkout_batch_id TEXT REFERENCES checkout_batches(id);
--> statement-breakpoint
CREATE TABLE checkout_batch_items (
 batch_id TEXT NOT NULL REFERENCES checkout_batches(id),
 loan_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('success','failed')),
 error TEXT NOT NULL DEFAULT '',
 updated TEXT NOT NULL,
 PRIMARY KEY(batch_id,loan_id)
);
--> statement-breakpoint
CREATE INDEX checkout_batch_actor_idx ON checkout_batches(actor_id,created);
