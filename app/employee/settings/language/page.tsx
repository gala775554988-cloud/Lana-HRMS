import { ClientLanguageToggle } from "@/components/i18n/client-language-toggle";
import { getRequestDictionary } from "@/lib/i18n-server";

export default async function LanguageSettings() {
  const { locale } = await getRequestDictionary();
  const arabic = locale === "ar";

  return (
    <section className="lana-card space-y-4 p-6">
      <h1 className="text-2xl">{arabic ? "لغة الواجهة" : "Interface language"}</h1>
      <p className="text-sm text-muted-foreground">
        {arabic ? "يُطبّق اختيارك على واجهة Lana في هذا المتصفح." : "Your choice applies to Lana in this browser."}
      </p>
      <ClientLanguageToggle variant="outline" />
    </section>
  );
}
