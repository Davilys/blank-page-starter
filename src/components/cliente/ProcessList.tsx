import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, FileText } from 'lucide-react';

interface ProcessListProps {
  userId?: string;
  limit?: number;
}

interface BrandProcess {
  id: string;
  brand_name: string;
  status: string;
  process_number: string | null;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  em_andamento: { label: 'Em Andamento', variant: 'secondary' },
  publicado_rpi: { label: 'Publicado RPI', variant: 'default' },
  em_exame: { label: 'Em Exame', variant: 'secondary' },
  deferido: { label: 'Deferido', variant: 'default' },
  concedido: { label: 'Concedido', variant: 'default' },
  indeferido: { label: 'Indeferido', variant: 'destructive' },
  arquivado: { label: 'Arquivado', variant: 'outline' },
};

export function ProcessList({ userId, limit }: ProcessListProps) {
  const [processes, setProcesses] = useState<BrandProcess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchProcesses = async () => {
      let query = supabase
        .from('brand_processes')
        .select('id, brand_name, status, process_number, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data } = await query;
      setProcesses(data || []);
      setLoading(false);
    };

    fetchProcesses();
  }, [userId, limit]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meus Processos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Meus Processos</CardTitle>
        {limit && processes.length > 0 && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/cliente/processos">
              Ver todos <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {processes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum processo encontrado</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {processes.map((process, index) => {
              const status = statusConfig[process.status] || statusConfig.em_andamento;
              return (
                <Link
                  key={process.id}
                  to={`/cliente/processos/${process.id}`}
                  className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
                >
                  <div className="space-y-1">
                    <p className="font-medium group-hover:text-primary transition-colors">{process.brand_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {process.process_number || 'Aguardando protocolo'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={status.variant} className="transition-transform group-hover:scale-105">
                      {status.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
