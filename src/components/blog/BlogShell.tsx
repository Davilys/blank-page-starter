import { Link } from 'react-router-dom';
import logo from '@/assets/webmarcas-logo-mark.webp';
import { ConsultationFooter } from '@/components/consultar/ConsultationFooter';
import './BlogVery.css';
export function BlogHeader(){return <header className="wb-header"><Link className="wb-brand" to="/"><img src={logo} alt=""/>WebMarcas<span>.</span></Link><nav aria-label="Navegação do blog"><Link to="/">O site</Link><Link to="/blog">Blog</Link><Link className="wb-header-cta" to="/consultar">Consultar marca ↗</Link></nav></header>}
export function BlogFooter(){return <div className="wm-entry wb-consult-footer"><div className="wrap"><ConsultationFooter entry/></div></div>}
