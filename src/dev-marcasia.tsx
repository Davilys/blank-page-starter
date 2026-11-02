import { createRoot } from 'react-dom/client';
import './index.css';
import MarcasIA from './components/admin/marcas-ia/MarcasIA';

createRoot(document.getElementById('root')!).render(
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <MarcasIA />
  </div>
);
