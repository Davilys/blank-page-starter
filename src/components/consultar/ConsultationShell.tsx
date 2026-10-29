import type { ReactNode } from "react";
import { ConsultationHeader } from "./ConsultationEntry";
import hero from "@/assets/consultar-very-hero.jpg";
import "./ConsultationFlow.css";
export default function ConsultationShell({ children, step, label }: { children: ReactNode; step?: number; label?: string }) {
 const current=step||(label?.includes("PAGAMENTO")?5:label?.includes("FINALIZA")?6:1);
 return <div className="wm-entry wm-flow"><ConsultationHeader /><main className="wm-flow-layout"><aside className="wm-flow-rail"><div className="wm-rail-copy"><span className="wm-kicker">WEBMARCAS · REGISTRO DE MARCAS</span><h1>Sua marca.<br/>Seu próximo passo.</h1><p>Consulta, dados e contratação.<br/>Tudo em um só lugar.</p></div><img src={hero} alt="" /><div className="wm-rail-bottom"><span>REGISTRO DE MARCAS</span><span>Da consulta ao registro ↗</span></div></aside><div className="wm-flow-content"><div className="wm-progress-lines" role="progressbar" aria-label="Progresso do registro" aria-valuemin={1} aria-valuemax={6} aria-valuenow={current}>{[1,2,3,4,5,6].map(i=><span key={i} className={current>=i?"is-filled":""} />)}</div><section className="wm-flow-screen"><div className="step">{label || (step ? `ETAPA ${step} DE 6` : "CONSULTA DE MARCA")}</div>{children}</section><div className="wm-flow-foot"><span>WebMarcas Intelligence PI</span><span>Registro de Marcas · INPI</span></div></div></main></div>;
}
