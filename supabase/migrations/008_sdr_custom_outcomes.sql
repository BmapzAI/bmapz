-- 008: SDR custom outcomes
--
-- Adds a machine-readable list of USER-DEFINED outcomes the SDR may choose from,
-- on top of the built-in outcomes gated by allowed_outcomes (migration 007).
--
-- Each custom outcome is: { key, label, description, effects } where effects can
-- bundle CRM actions the system executes when the SDR picks it:
--   { mark_qualified: bool, set_stage: '<funnel stage>'|'next'|null,
--     handover: bool, redirect_url: '<url>'|null }
--
-- The SDR can ONLY ever emit an outcome that the user enabled (built-in) or
-- defined here (custom); anything else is clamped to "none" server-side.

ALTER TABLE public.sdr_agents
  ADD COLUMN IF NOT EXISTS custom_outcomes JSONB DEFAULT '[]';
