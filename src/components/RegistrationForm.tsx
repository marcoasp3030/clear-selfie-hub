import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createRegistration } from "@/server/registrations.functions";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import { PhotoCapture } from "./PhotoCapture";
import { PhotoGuidelines } from "./PhotoGuidelines";

const schema = z.object({
  firstName: z.string().trim().min(2, "Informe seu nome").max(100, "Nome muito longo"),
  lastName: z
    .string()
    .trim()
    .min(2, "Informe seu sobrenome")
    .max(100, "Sobrenome muito longo"),
  phone: z
    .string()
    .trim()
    .min(14, "Informe um celular válido")
    .max(20, "Celular muito longo")
    .regex(/^[\d\s()+-]+$/, "Celular inválido"),
});

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

type Step = 0 | 1 | 2;

export function RegistrationForm() {
  const [step, setStep] = useState<Step>(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const submitRegistration = useServerFn(createRegistration);

  const goPhoto = () => {
    if (!photo) {
      setErrors({ photo: "Adicione uma foto para continuar." });
      return;
    }
    setErrors({});
    setStep(1);
  };

  const submit = async () => {
    setErrors({});
    const result = schema.safeParse({ firstName, lastName, phone });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString();
        if (key) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    if (!photo) {
      setStep(0);
      setErrors({ photo: "Adicione uma foto para continuar." });
      return;
    }

    setSubmitting(true);
    try {
      const fingerprint = await getDeviceFingerprint();

      const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("registration-photos")
        .upload(path, photo, { contentType: photo.type, upsert: false });
      if (uploadError) throw uploadError;

      const response = await submitRegistration({
        data: {
          firstName: result.data.firstName,
          lastName: result.data.lastName,
          phone: result.data.phone,
          photoPath: path,
          deviceFingerprint: fingerprint,
        },
      });

      if (!response.success) {
        if (response.error === "duplicate_device") {
          toast.error(
            "Este dispositivo já realizou um cadastro. Apenas um cadastro por aparelho é permitido."
          );
        } else {
          toast.error("Não foi possível enviar. Tente novamente.");
        }
        return;
      }

      setStep(2);
      toast.success("Cadastro enviado!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setPhoto(null);
    setErrors({});
    setStep(0);
  };

  if (step === 2) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Cadastro recebido!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Obrigado, {firstName}. Entraremos em contato pelo celular informado.
        </p>
        <Button onClick={reset} size="lg" className="mt-6 w-full">
          Fazer novo cadastro
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              step >= i ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Passo {step + 1} de 2
        </p>
        <p className="text-xs text-muted-foreground">
          {step === 0 ? "Foto do rosto" : "Seus dados"}
        </p>
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
            <h2 className="text-lg font-semibold text-foreground">Tire uma foto do rosto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use a câmera frontal e encaixe o rosto no oval.
            </p>
            <div className="mt-4">
              <PhotoCapture value={photo} onChange={setPhoto} />
            </div>
            {errors.photo && (
              <p className="mt-2 text-sm text-destructive">{errors.photo}</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
            <h3 className="text-base font-semibold text-foreground">
              Como tirar a foto perfeita
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Siga as recomendações para a foto ser aceita.
            </p>
            <div className="mt-4">
              <PhotoGuidelines />
            </div>
          </div>

          <Button
            onClick={goPhoto}
            size="lg"
            className="h-14 w-full text-base"
            disabled={!photo}
          >
            Continuar
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Seus dados</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Preencha para finalizar o cadastro.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="João"
                maxLength={100}
                autoComplete="given-name"
                disabled={submitting}
                className="h-12 text-base"
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Silva"
                maxLength={100}
                autoComplete="family-name"
                disabled={submitting}
                className="h-12 text-base"
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Celular</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 91234-5678"
                autoComplete="tel"
                disabled={submitting}
                className="h-12 text-base"
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setStep(0)}
              disabled={submitting}
              className="h-14"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button
              onClick={submit}
              size="lg"
              className="h-14 flex-1 text-base"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando...
                </>
              ) : (
                "Enviar cadastro"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
