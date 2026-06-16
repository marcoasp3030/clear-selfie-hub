import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSintegrawsToken } from "@/server/sintegrawsSettings.server";
import { callSintegrawsCpf } from "./sintegrawsCpf.server";

/** CPF check-digit validation (same algorithm used no frontend). */
function isValidCpfDigits(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i], 10) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return (
    calc(9) === parseInt(cpf[9], 10) && calc(10) === parseInt(cpf[10], 10)
  );
}

/** Validates ddmmaaaa: real calendar day, month 1-12, year 1900..currentYear. */
function isValidBirthDigits(v: string): boolean {
  if (!/^\d{8}$/.test(v)) return false;
  const day = parseInt(v.slice(0, 2), 10);
  const month = parseInt(v.slice(2, 4), 10);
  const year = parseInt(v.slice(4, 8), 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

const inputSchema = z.object({
  cpf: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "CPF deve conter 11 dígitos numéricos (formato 00000000000).")
    .refine(isValidCpfDigits, "CPF inválido."),
  // Date in ddmmaaaa format (8 digits).
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Data de nascimento deve estar no formato ddmmaaaa.")
    .refine(isValidBirthDigits, "Data de nascimento inválida."),
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
