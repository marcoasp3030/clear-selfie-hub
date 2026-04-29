DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'marcoasp.r@outlook.com';
  v_old_email text := 'marcoasp.r@outlook..com';
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) IN (v_email, v_old_email)
  ORDER BY CASE WHEN lower(email) = v_email THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt('32443030', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET
      email = v_email,
      encrypted_password = crypt('32443030', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      updated_at = now(),
      confirmation_token = '',
      email_change = '',
      email_change_token_new = '',
      recovery_token = ''
    WHERE id = v_user_id;
  END IF;

  DELETE FROM auth.identities
  WHERE provider = 'email'
    AND user_id <> v_user_id
    AND lower(identity_data->>'email') = v_email;

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE
  SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;