import { BadgeCheck, ShieldCheck, Users, Zap } from "lucide-react";

const badges = [
  { icon: Users, label: "+11.000 marcas" },
  { icon: Zap, label: "Protocolo em 48h" },
  { icon: ShieldCheck, label: "Blockchain" },
  { icon: BadgeCheck, label: "INPI Oficial" },
];

export default function RegistrationTrustFooter() {
  return (
    <div className="mt-8 space-y-5">
      <ul aria-label="Credenciais WebMarcas" className="grid grid-cols-2 gap-3 min-[680px]:grid-cols-4">
        {badges.map(({ icon: Icon, label }) => (
          <li key={label} className="flex min-h-16 min-w-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-card-foreground shadow-sm">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 break-words text-center text-sm font-bold leading-5 tracking-normal">
              {label}
            </span>
          </li>
        ))}
      </ul>
      <p className="mx-auto max-w-lg text-center text-[13px] leading-6 tracking-normal text-muted-foreground">
        Ao continuar, você concorda com nossos{" "}
        <a href="/termos" className="rounded-sm underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Termos de Uso</a>
        {" "}e{" "}
        <a href="/privacidade" className="rounded-sm underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Política de Privacidade</a>.
      </p>
    </div>
  );
}