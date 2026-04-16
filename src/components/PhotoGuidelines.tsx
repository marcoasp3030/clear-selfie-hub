import { Check } from "lucide-react";
import photoExamples from "@/assets/photo-examples.png";

const tips = [
  "Centralize bem o rosto",
  "Lugar iluminado, com parede ao fundo",
  "Apenas um rosto na foto",
  "Sem máscara, boné, capacete ou óculos de sol",
  "Óculos de grau são permitidos sem reflexo nas lentes",
];

export function PhotoGuidelines() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <img
          src={photoExamples}
          alt="Exemplos de fotos válidas para cadastro"
          className="w-full"
        />
      </div>

      <ul className="space-y-2">
        {tips.map((tip) => (
          <li
            key={tip}
            className="flex items-start gap-3 rounded-xl bg-card px-3.5 py-3 text-sm text-foreground shadow-sm"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="leading-snug">{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
