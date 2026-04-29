// Server-only Control iD device integration helpers.
// Talks to the equipment's Access-API (*.fcgi endpoints).
// NEVER import from client code.

export type ControlIdSyncResult =
  | { success: true; deviceUserId: number }
  | { success: false; error: string };

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

async function fcgi<T = unknown>(
  url: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, error: `Resposta inválida do equipamento: ${text.slice(0, 200)}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Falha de comunicação: ${msg}` };
  }
}

async function login(
  base: string,
  loginUser: string,
  password: string,
): Promise<string | { error: string }> {
  const r = await fcgi<{ session?: string }>(`${base}/login.fcgi`, {
    login: loginUser,
    password,
  });
  if (!r.ok) return { error: `Login no equipamento falhou — ${r.error}` };
  if (!r.data.session) return { error: "Equipamento não retornou sessão (verifique login/senha)." };
  return r.data.session;
}

async function createUser(
  base: string,
  session: string,
  fullName: string,
  registration: string,
  cpf: string,
): Promise<number | { error: string }> {
  const r = await fcgi<{ ids?: number[] }>(
    `${base}/create_objects.fcgi?session=${encodeURIComponent(session)}`,
    {
      object: "users",
      values: [
        {
          name: fullName,
          registration,
          cpf,
          password: "",
          salt: "",
        },
      ],
    },
  );
  if (!r.ok) return { error: `Erro ao criar usuário no equipamento — ${r.error}` };
  const id = r.data?.ids?.[0];
  if (typeof id !== "number") return { error: "Equipamento não retornou ID do usuário criado." };
  return id;
}

function imageErrorMessage(code: number, message: string): string {
  switch (code) {
    case 1:
      return `Foto rejeitada: ${message}. Verifique se a imagem é JPG/PNG.`;
    case 2:
      return "Nenhuma face detectada na imagem. Centralize o rosto e tente outra foto.";
    case 3:
      return "Esta face já está cadastrada no equipamento.";
    case 4:
      return "A face não está centralizada. Tente novamente com o rosto no centro.";
    case 5:
      return "Rosto muito distante da câmera. Aproxime-se e tire outra foto.";
    case 6:
      return "Rosto muito próximo da câmera. Afaste-se um pouco.";
    case 7:
      return "Pose do rosto inadequada. Olhe para a câmera de frente.";
    case 8:
      return "Imagem com baixa nitidez. Use uma foto mais nítida.";
    case 9:
      return "Rosto muito próximo das bordas. Centralize o rosto na imagem.";
    default:
      return `Erro ao cadastrar foto (código ${code}): ${message}`;
  }
}

async function setUserImage(
  base: string,
  session: string,
  userId: number,
  imageBase64: string,
): Promise<true | { error: string }> {
  const r = await fcgi<{
    results?: Array<{
      success?: boolean | number;
      user_id?: number;
      errors?: Array<{ code: number; message: string }>;
    }>;
  }>(`${base}/user_set_image_list.fcgi?session=${encodeURIComponent(session)}`, {
    match: false,
    user_images: [
      {
        user_id: Number(userId),
        timestamp: Math.floor(Date.now() / 1000),
        image: imageBase64,
      },
    ],
  });
  if (!r.ok) return { error: `Erro ao enviar foto ao equipamento — ${r.error}` };
  const result = r.data?.results?.[0];
  if (result?.success === true || result?.success === 1) return true;
  const firstErr = result?.errors?.[0];
  if (firstErr) return { error: imageErrorMessage(firstErr.code, firstErr.message) };
  return {
    error: `Equipamento rejeitou a foto sem detalhes. Resposta: ${JSON.stringify(r.data).slice(0, 300)}`,
  };
}

async function enableUser(
  base: string,
  session: string,
  userId: number,
): Promise<true | { error: string }> {
  const r = await fcgi<{ ids?: number[] }>(
    `${base}/create_objects.fcgi?session=${encodeURIComponent(session)}`,
    {
      object: "user_groups",
      fields: ["user_id", "group_id"],
      values: [{ user_id: userId, group_id: 1 }],
    },
  );
  if (!r.ok) return { error: `Erro ao habilitar usuário — ${r.error}` };
  if (!r.data?.ids?.[0]) return { error: "Equipamento não confirmou a habilitação do usuário." };
  return true;
}

/**
 * Full sync flow: login → create user → set face image → enable user.
 * Phone is concatenated into the user's name (Control iD users object has no
 * dedicated phone field).
 */
export async function syncRegistrationToControlId(input: {
  apiBaseUrl: string;
  apiLogin: string;
  apiPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  cpf: string;
  imageBase64: string;
}): Promise<ControlIdSyncResult> {
  const base = normalizeBase(input.apiBaseUrl);

  const session = await login(base, input.apiLogin, input.apiPassword);
  if (typeof session !== "string") return { success: false, error: session.error };

  // Mapeamento nos campos nativos do equipamento Control iD:
  //   - name         → "Nome Sobrenome"
  //   - registration → telefone (matrícula)
  //   - cpf          → CPF (campo nativo, 11 dígitos sem formatação)
  const fullName = `${input.firstName} ${input.lastName}`.slice(0, 100);
  const registration = (input.phone || "").slice(0, 64);
  const cpf = (input.cpf || "").slice(0, 14);

  const userId = await createUser(base, session, fullName, registration, cpf);
  if (typeof userId !== "number") return { success: false, error: userId.error };

  const photoOk = await setUserImage(base, session, userId, input.imageBase64);
  if (photoOk !== true) return { success: false, error: photoOk.error };

  const enabled = await enableUser(base, session, userId);
  if (enabled !== true) return { success: false, error: enabled.error };

  return { success: true, deviceUserId: userId };
}