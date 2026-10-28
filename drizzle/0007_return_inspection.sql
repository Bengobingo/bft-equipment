CREATE TABLE return_requests (
 id TEXT PRIMARY KEY NOT NULL,
 loan_id TEXT NOT NULL REFERENCES loans(id),
 requester_id TEXT NOT NULL REFERENCES users(id),
 requested TEXT NOT NULL,
 request_note TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending',
 reviewer_id TEXT REFERENCES users(id),
 reviewed TEXT,
 review_note TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX return_requests_loan_idx ON return_requests(loan_id);
--> statement-breakpoint
CREATE UNIQUE INDEX return_requests_pending_idx ON return_requests(loan_id) WHERE status = 'pending';
