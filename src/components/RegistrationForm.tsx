import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhotoCapture } from "./PhotoCapture";

const schema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Informe seu nome")
    .max(100, "Nome muito longo"),
  lastName: z
    .string()
    .trim()
    .min(2, "Informe seu sobrenome")
    .max(100, "Sobrenome muito longo"),
  phone: z
    .string()
    .trim()
    .min(10, "Informe um celular válido")
    .max(20, "Celular muito longo")
    .regex(/^[\d\s()+-]+$/, "Use apenas números e símbolos válidos"),
});

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function RegistrationForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!photo) {
      setErrors({ photo: "Adicione uma foto para concluir o cadastro." });
      return;
    }

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

    setSubmitting(true);
    try {
      const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("registration-photos")
        .upload(path, photo, { contentType: photo.type, upsert: false });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("registrations").insert({
        first_name: result.data.firstName,
        last_name: result.data.lastName,
        phone: result.data.phone,
        photo_path: path,
      });

      if (insertError) throw insertError;

      setSuccess(true);
      toast.success("Cadastro enviado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível enviar o cadastro. Tente novamente.");
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
    setSuccess(false);
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Cadastro recebido!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Obrigado, {firstName}. Entraremos em contato em breve pelo celular informado.
        </p>
        <Button onClick={reset} className="mt-6">
          Fazer novo cadastro
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
          />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName}</p>
          )}
        </div>
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
        />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Foto do rosto</Label>
        <PhotoCapture value={photo} onChange={setPhoto} />
        {errors.photo && <p className="text-xs text-destructive">{errors.photo}</p>}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
          </>
        ) : (
          "Enviar cadastro"
        )}
      </Button>
    </form>
  );
}
