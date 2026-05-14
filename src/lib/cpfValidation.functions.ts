import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  cpf: z.string().trim().regex(/^\d{11}$/, "CPF inválido"),
  // Date in ddmmaaaa format (8 digits).
  birthDate: z.string().trim().regex(/^\d{8}$/, "Data inválida"),
});

type ApiResponse = {
  code?: string;
  status?: string;
  message?: string;
  nome?: string;
  data_nascimento?: string;
};

export const validateCpfWithReceita = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const token = process.env.SINTEGRAWS_TOKEN;
    if (!token) {
      console.error("[cpf-validation] SINTEGRAWS_TOKEN not configured");
      return {
        success: false as const,
        error: "config_missing" as const,
        message: "Validação de CPF não configurada no servidor.",
      };
    }

    const url = new URL("https://www.sintegraws.com.br/api/v1/execute-api.php");
    url.searchParams.set("token", token);
    url.searchParams.set("cpf", data.cpf);
    url.searchParams.set("data-nascimento", data.birthDate);
    url.searchParams.set("plugin", "CPF");

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; NutricarFacial/1.0; +https://facial.nutricarbrasil.com.br)",
        },
      });
    } catch (err) {
      console.error("[cpf-validation] network error:", err);
      return {
        success: false as const,
        error: "network_error" as const,
        message: "Não foi possível contatar a Receita Federal. Tente novamente.",
      };
    }

    let body: ApiResponse;
    try {
      const text = await res.text();
      try {
        body = JSON.parse(text) as ApiResponse;
      } catch {
        console.error(
          "[cpf-validation] invalid JSON, status=",
          res.status,
          "body=",
          text.slice(0, 500),
        );
        return {
          success: false as const,
          error: "invalid_response" as const,
          message: `Resposta inválida do serviço de validação (HTTP ${res.status}).`,
        };
      }
    } catch (err) {
      console.error("[cpf-validation] read error:", err);
      return {
        success: false as const,
        error: "invalid_response" as const,
        message: "Resposta inválida do serviço de validação.",
      };
    }

    const code = String(body.code ?? "");
    if (code === "0") {
      return {
        success: true as const,
        nome: body.nome ?? null,
        dataNascimento: body.data_nascimento ?? null,
      };
    }

    // Mapear códigos conhecidos para mensagens amigáveis
    const friendly: Record<string, string> = {
      "1": "CPF não encontrado na Receita Federal.",
      "2": "CPF inválido.",
      "3": "Token de validação inválido. Contate o administrador.",
      "4": "Pacote de créditos da validação não contratado.",
      "5": "Os créditos da validação acabaram. Contate o administrador.",
      "6": "Plugin de validação não configurado.",
      "7": "Receita Federal está com instabilidade. Tente novamente em instantes.",
      "8": "Erro interno no serviço de validação.",
      "9": "Data de nascimento não confere com o CPF informado.",
    };
    return {
      success: false as const,
      error: ("code_" + (code || "unknown")) as `code_${string}`,
      message: friendly[code] ?? body.message ?? "Não foi possível validar o CPF.",
    };
  });