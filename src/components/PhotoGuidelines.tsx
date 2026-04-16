import { Check } from "lucide-react";
import photoExamples from "@/assets/photo-examples.png";

const tips = [
  "Centralize bem o rosto.",
  "Mantenha-se em um lugar iluminado, com uma parede ao fundo.",
  "Cuidado para não ter mais de um rosto na foto.",
  "Não use máscara, boné, capacete, óculos de sol ou qualquer objeto na cabeça.",
  "Óculos de grau são permitidos desde que não haja reflexo nas lentes (olhos perfeitamente visíveis).",
];

export function PhotoGuidelines() {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div>
        <h3 className="text-base font-semibold text-foreground">Orientações para tirar a foto</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Siga as recomendações abaixo para garantir que a foto seja aceita.
        </p>
      </div>

      <ul className="space-y-2.5">
        {tips.map((tip) => (
          <li key={tip} className="flex gap-2.5 text-sm text-foreground">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Exemplos de fotos válidas
        </p>
        <img
          src={photoExamples}
          alt="Exemplos de fotos válidas para cadastro"
          className="w-full rounded-xl border border-border"
        />
      </div>
    </div>
  );
}
