-- ─── Migration 004: Fix auth user (GoTrue v2 compatible) ─────────────────────
-- Run this in: Supabase Dashboard > SQL Editor
-- This fixes the identity record that was incorrectly created by migration 003.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id UUID;
  v_email   TEXT := 'guilherme.sampaio@live.com';
BEGIN
  -- Get the user id
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    -- User doesn't exist yet — create fresh
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_email,
      crypt('Jifg181020', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Guilherme Sampaio"}'::jsonb,
      FALSE, NOW(), NOW()
    );
    RAISE NOTICE 'Usuário criado: % (id: %)', v_email, v_user_id;
  ELSE
    -- User exists — make sure password and confirmation are correct
    UPDATE auth.users SET
      encrypted_password  = crypt('Jifg181020', gen_salt('bf')),
      email_confirmed_at  = COALESCE(email_confirmed_at, NOW()),
      raw_app_meta_data   = '{"provider":"email","providers":["email"]}'::jsonb,
      updated_at          = NOW()
    WHERE id = v_user_id;
    RAISE NOTICE 'Usuário atualizado: % (id: %)', v_email, v_user_id;
  END IF;

  -- Remove any bad identity records for this user (from migration 003)
  DELETE FROM auth.identities WHERE user_id = v_user_id;

  -- Re-insert identity using GoTrue v2 schema
  -- In GoTrue v2: PRIMARY KEY is (provider, provider_id), id is auto UUID, email is GENERATED
  -- We do NOT insert: id (auto), email (generated always)
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (
    v_email,          -- provider_id = email address for the email provider
    v_user_id,
    json_build_object(
      'sub',            v_user_id::text,
      'email',          v_email,
      'email_verified', true,
      'provider',       'email'
    )::jsonb,
    'email',
    NOW(), NOW(), NOW()
  );

  -- Ensure crm_users entry
  INSERT INTO crm_users (id, email, display_name, role, is_active, created_at)
  VALUES (v_user_id, v_email, 'Guilherme Sampaio', 'admin', TRUE, NOW())
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role         = 'admin',
    is_active    = TRUE;

  RAISE NOTICE 'Concluído. User id: %', v_user_id;
END $$;
