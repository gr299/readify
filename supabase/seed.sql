-- Seed data for Readify
-- Run this in Supabase SQL Editor after running schema.sql

-- Insert demo users (passwords: Admin123! and User123!)
INSERT INTO users (name, email, password_hash, role, active) VALUES
  ('Admin User', 'admin@readify.app', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4VQyZ8x5mXq5q0iW', 'admin', 1),
  ('Alice', 'alice@readify.app', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4VQyZ8x5mXq5q0iW', 'user', 1),
  ('Bob', 'bob@readify.app', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4VQyZ8x5mXq5q0iW', 'user', 1)
ON CONFLICT (email) DO NOTHING;

-- Insert categories
INSERT INTO categories (name, slug) VALUES
  ('Technology', 'technology'),
  ('Design', 'design'),
  ('Business', 'business'),
  ('Programming', 'programming'),
  ('Lifestyle', 'lifestyle')
ON CONFLICT (slug) DO NOTHING;

-- Insert tags
INSERT INTO tags (name, slug) VALUES
  ('javascript', 'javascript'),
  ('react', 'react'),
  ('nodejs', 'nodejs'),
  ('webdev', 'webdev'),
  ('tutorial', 'tutorial'),
  ('ai', 'ai'),
  ('productivity', 'productivity'),
  ('career', 'career')
ON CONFLICT (slug) DO NOTHING;

-- Insert settings
INSERT INTO settings (key, value) VALUES
  ('site_name', 'Readify'),
  ('site_tagline', 'Read, write, and share great stories.'),
  ('allow_registration', '1'),
  ('articles_per_page', '12'),
  ('require_review_before_publish', '1')
ON CONFLICT (key) DO NOTHING;
