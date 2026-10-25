-- Existing kit custodians join PED engineering staff without changing account IDs
-- or historical records. Reauthentication refreshes the member's role display.
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role='custodian');
--> statement-breakpoint
UPDATE users SET role='approver' WHERE role='custodian';
