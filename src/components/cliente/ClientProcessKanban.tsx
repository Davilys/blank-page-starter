import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileText, ChevronRight, Settings2 } from 'lucide-react';
import { ClientKanbanConfig, type KanbanStage } from './ClientKanbanConfig';

interface ClientProcessKanbanProps {
  userId?: string;
}

interface BrandProcess {
  id: string;
  brand_name: string;
  status: string;
  process_number: string | null;
  updated_at: string;
}

const DEFAULT_STAGES: KanbanStage[] = [
  { id: 'em_andamento', name: 'Em Andamento', color: '#3B82F6' },
  { id: 'publicado_rpi', name: 'Publicado RPI', color: '#8B5CF6' },
  { id: 'em_exame', name: 'Em Exame', color: '#F59E0B' },
  { id: 'deferido', name: 'Deferido', color: '#10B981' },
  { id: 'concedido', name: 'Concedido', color: '#22C55E' },
  { id: 'indeferido', name: 'Indeferido', color: '#EF4444' },
  { id: 'arquivado', name: 'Arquivado', color: '#6B7280' },
];

export function ClientProcessKanban({ userId }: ClientProcessKanbanProps) {
  const [processes, setProcesses] = useState<BrandProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<KanbanStage[]>(DEFAULT_STAGES);
  const [configOpen, setConfigOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadStages = async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'client_kanban_stages')
      .maybeSingle();

    if (data?.value && typeof data.value === 'object' && 'stages' in (data.value as any)) {
      setStages((data.value as any).stages);
    }
  };

  useEffect(() => {
    loadStages();
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchProcesses = async () => {
      const { data } = await supabase
        .from('brand_processes')
        .select('id, brand_name, status, process_number, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      setProcesses(data || []);
      setLoading(false);
    };

    fetchProcesses();
  }, [userId]);

  const getProcessesByStatus = (status: string) => {
    return processes.filter(p => p.status === status);
  };

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-[280px] h-64 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (processes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum processo encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {isAdmin && (
        <div className="flex items-center justify-end mb-3">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="gap-2">
            <Settings2 className="h-4 w-4" />
            Configurar Etapas
          </Button>
        </div>
      )}

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4">
          {stages.map((column) => {
            const columnProcesses = getProcessesByStatus(column.id);

            return (
              <div key={column.id} className="min-w-[300px] max-w-[300px]">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
                        {column.name}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {columnProcesses.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {columnProcesses.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhum processo
                      </p>
                    ) : (
                      columnProcesses.map((process) => (
                        <Link
                          key={process.id}
                          to={`/cliente/processos/${process.id}`}
                          className="block p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                {process.brand_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {process.process_number || 'Aguardando protocolo'}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-1" />
                          </div>
                        </Link>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <ClientKanbanConfig
        open={configOpen}
        onOpenChange={setConfigOpen}
        stages={stages}
        onSaved={loadStages}
      />
    </>
  );
}
