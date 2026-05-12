import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UazapiConfigCard } from "./admin.whatsapp";

export const Route = createFileRoute("/admin/whatsapp/config")({
  head: () => ({
    meta: [{ title: "Configuração uazapi · Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: WhatsAppConfigPage,
});

function WhatsAppConfigPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Settings className="h-6 w-6 text-primary" /> Configuração da uazapi
          </h1>
          <p className="text-sm text-muted-foreground">
            Defina o Server URL e o Admin Token usados pelas integrações WhatsApp.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/whatsapp">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>
      <UazapiConfigCard />
    </div>
  );
}
