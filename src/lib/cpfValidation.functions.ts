import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSintegrawsToken } from "@/server/sintegrawsSettings.server";
import { callSintegrawsCpf } from "./sintegrawsCpf.server";

const inputSchema = z.object({
  cpf: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "CPF inválido"),
  // Date in ddmmaaaa format (8 digits).
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Data inválida"),
});

export const validateCpfWithReceita = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const token = await getSintegrawsToken();
    if (!token) {
      console.error("[cpf-validation] SINTEGRAWS_TOKEN not configured");
      return {
        success: false as const,
        error: "config_missing" as const,
        message: "Validação de CPF não configurada no servidor.",
      };
    }

    const result = await callSintegrawsCpf(token, data.cpf, data.birthDate);
    if (!result.ok) {
      console.error("[cpf-validation] SintegraWS error:", result.kind, result.status);
      return {
        success: false as const,
        error: result.kind,
        message: result.message,
      };
    }

    const body = result.body;

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
