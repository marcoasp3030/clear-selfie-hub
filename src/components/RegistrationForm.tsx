import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Camera,
  UserRound,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createRegistration } from "@/server/registrations.functions";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import { collectClientDeviceInfo } from "@/lib/deviceInfo";
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

const STEPS = [
  { label: "Foto", icon: Camera },
  { label: "Dados", icon: UserRound },
] as const;

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
      <div
        className="overflow-hidden rounded-3xl border border-border/60 bg-card p-8 text-center"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <CheckCircle2 className="h-10 w-10" strokeWidth={2.5} />
          </div>
        </div>
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          Tudo certo
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Cadastro recebido!
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Obrigado, <span className="font-medium text-foreground">{firstName}</span>.
          Entraremos em contato pelo celular informado em breve.
        </p>
        <Button
          onClick={reset}
          size="lg"
          variant="outline"
          className="mt-7 h-12 w-full text-base"
        >
          Fazer novo cadastro
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Modern stepper with icons */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === i;
            const isDone = step > i;
            return (
              <div key={s.label} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[10px] font-medium uppercase tracking-wider transition-colors ${
                      isActive || isDone ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    Passo {i + 1}
                  </p>
                  <p
                    className={`truncate text-sm font-semibold transition-colors ${
                      isActive || isDone ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-4 rounded-full transition-colors ${
                      isDone ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-4 duration-300 animate-in fade-in slide-in-from-bottom-2">
          <div
            className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Camera className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-foreground">
                  Tire uma foto do rosto
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Use a câmera frontal e encaixe o rosto no oval.
                </p>
              </div>
            </div>
            <PhotoCapture value={photo} onChange={setPhoto} />
            {errors.photo && (
              <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {errors.photo}
              </p>
            )}
          </div>

          <div
            className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-foreground">
                  Como tirar a foto perfeita
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Siga as recomendações para a foto ser aceita.
                </p>
              </div>
            </div>
            <PhotoGuidelines />
          </div>

          <Button
            onClick={goPhoto}
            size="lg"
            className="h-14 w-full text-base font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
            disabled={!photo}
          >
            Continuar
            <ArrowRight className="ml-1 h-5 w-5" />
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 duration-300 animate-in fade-in slide-in-from-bottom-2">
          <div
            className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 sm:p-6"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-foreground">Seus dados</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Preencha para finalizar o cadastro.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm font-medium">
                  Nome
                </Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="João"
                  maxLength={100}
                  autoComplete="given-name"
                  disabled={submitting}
                  className="h-12 rounded-xl border-border/70 text-base transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
                />
                {errors.firstName && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.firstName}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm font-medium">
                  Sobrenome
                </Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Silva"
                  maxLength={100}
                  autoComplete="family-name"
                  disabled={submitting}
                  className="h-12 rounded-xl border-border/70 text-base transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
                />
                {errors.lastName && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.lastName}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Celular
                </Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 91234-5678"
                  autoComplete="tel"
                  disabled={submitting}
                  className="h-12 rounded-xl border-border/70 text-base transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
                />
                {errors.phone && (
                  <p className="text-xs font-medium text-destructive">{errors.phone}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setStep(0)}
              disabled={submitting}
              className="h-14 w-14 shrink-0 rounded-xl border-border/70"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button
              onClick={submit}
              size="lg"
              className="h-14 flex-1 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  Finalizar cadastro
                  <CheckCircle2 className="ml-1 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
