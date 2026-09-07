-- Migration: Add paid_amount to purchase_order & update payment_status check constraint

ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT NULL;

ALTER TABLE purchase_order DROP CONSTRAINT IF EXISTS purchase_order_payment_status_check;
ALTER TABLE purchase_order ADD CONSTRAINT purchase_order_payment_status_check CHECK (payment_status IN ('unpaid', 'paid', 'lunas'));
