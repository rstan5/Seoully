-- Intentionally superseded UNAPPLIED migration: preserve version/order as a no-op.
-- 20261003 persists curated Room Style; the current DAL never reads/writes theme_id.
-- Do not add or remove any column here. No rollback of any deployed schema is intended.
select 1;
