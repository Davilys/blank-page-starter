import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/cliente/ClientLayout';
import { ProcessList } from '@/components/cliente/ProcessList';
import { ClientProcessKanban } from '@/components/cliente/ClientProcessKanban';
import { PublicacoesCliente } from '@/components/cliente/PublicacoesCliente';
import { Button } from '@/components/ui/button';
import { List, LayoutGrid } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

export default function Processos() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate('/cliente/login');
        } else {
          setUser(session.user);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/cliente/login');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meus Processos</h1>
            <p className="text-muted-foreground">
              Acompanhe todos os seus processos de registro de marca
            </p>
          </div>
          
          {/* View Toggle */}
          <div className="flex gap-2">
            <Button 
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
            <Button 
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Kanban
            </Button>
          </div>
        </div>

        {viewMode === 'list' ? (
          <ProcessList userId={user?.id} />
        ) : (
          <ClientProcessKanban userId={user?.id} />
        )}

        {/* Publicações de Marcas - somente leitura */}
        <PublicacoesCliente userId={user?.id} />
      </div>
    </ClientLayout>
  );
}
