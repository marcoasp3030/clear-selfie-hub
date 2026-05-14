export type SintegrawsCpfBody = {
  code?: string;
  status?: string;
  message?: string;
  nome?: string;
  data_nascimento?: string;
};

export type SintegrawsCpfResult =
  | {
      ok: true;
      status: number;
      body: SintegrawsCpfBody;
      raw: string;
    }
  | {
      ok: false;
      status: number;
      kind: "blocked" | "invalid_json" | "network_error";
      message: string;
      raw: string | null;
    };

const SINTEGRAWS_CPF_URL =
  "https://www.sintegraws.com.br/api/v1/execute-api.php";

function isGatewayBlocked(status: number, contentType: string | null, text: string) {
  return (
    status === 403 &&
    (contentType?.includes("text/html") || /<h1>403 Forbidden<\/h1>/i.test(text))
  );
}

export function buildSintegrawsCpfUrl(token: string, cpf: string, birthDate: string) {
  const url = new URL(SINTEGRAWS_CPF_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("cpf", cpf);
  url.searchParams.set("data-nascimento", birthDate);
  url.searchParams.set("plugin", "CPF");
  return url;
}

export async function callSintegrawsCpf(
  token: string,
  cpf: string,
  birthDate: string,
): Promise<SintegrawsCpfResult> {
  const url = buildSintegrawsCpfUrl(token, cpf, birthDate);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        // Mimic PHP cURL defaults — alguns WAFs bloqueiam fetch sem User-Agent
        "User-Agent": "curl/8.4.0",
        Accept: "*/*",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      kind: "network_error",
      message: `Falha de rede: ${msg}`,
      raw: null,
    };
  }

  const text = await res.text();
  const contentType = res.headers.get("content-type");

  if (isGatewayBlocked(res.status, contentType, text)) {
    return {
      ok: false,
      status: res.status,
      kind: "blocked",
      message:
        "O SintegraWS bloqueou a chamada antes de validar o token. Solicite ao suporte do SintegraWS a liberação das chamadas feitas pelo servidor da aplicação.",
      raw: null,
    };
  }

  try {
    const body = JSON.parse(text) as SintegrawsCpfBody;
    return { ok: true, status: res.status, body, raw: text };
  } catch {
    return {
      ok: false,
      status: res.status,
      kind: "invalid_json",
      message: `Resposta inválida do serviço de validação (HTTP ${res.status}).`,
      raw: text.slice(0, 1000),
    };
  }
}