-- Add neighborhood column to profiles table for storing bairro
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS neighborhood TEXT;

-- Add ots_file_url column to contracts table for storing .ots proof file URL
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS ots_file_url TEXT;