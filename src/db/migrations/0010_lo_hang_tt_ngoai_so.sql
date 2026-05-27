-- Migration 0010: Mark receipts as "paid but NOT booked in ledger"
-- Admin-only action and visibility. 0 = no, 1 = paid outside ledger.
ALTER TABLE lo_hang ADD COLUMN da_tt_ngoai_so INTEGER DEFAULT 0;
