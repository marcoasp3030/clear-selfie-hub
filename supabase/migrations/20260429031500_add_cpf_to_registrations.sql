-- Add CPF column to registrations (stored as 11 digits, no formatting)
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS cpf text;
