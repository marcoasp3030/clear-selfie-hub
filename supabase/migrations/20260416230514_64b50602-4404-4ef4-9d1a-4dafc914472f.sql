
-- Cria o primeiro usuário admin: admin@nutricar.com.br
DO $$
DECLARE
  v_user_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM auth.users WHERE email = 'admin@nutricar.com.br' LIMIT 1;

  IF v_existing_id IS NULL THEN
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
      'admin@nutricar.com.br',
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
      format('{"sub":"%s","email":"%s","email_verified":true}', v_user_id, 'admin@nutricar.com.br')::jsonb,
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    v_user_id := v_existing_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
