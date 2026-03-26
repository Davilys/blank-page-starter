import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ChevronRight, AlertCircle } from 'lucide-react';

interface FinancialSummaryProps {
  userId?: string;
}

interface Invoice {
  id: string;
  description: string;
  amount: number;
  status: string;
  due_date: string;
}

export function FinancialSummary({ userId }: FinancialSummaryProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchInvoices = async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, description, amount, status, due_date')
        .eq('user_id', userId)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(3);

      setInvoices((data as Invoice[]) || []);
      setLoading(false);
    };

    fetchInvoices();
  }, [userId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Financeiro
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/cliente/financeiro">
            Ver todos <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nenhuma fatura pendente 🎉
          </p>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {invoice.status === 'overdue' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{invoice.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence em {formatDate(invoice.due_date)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(invoice.amount)}</p>
                  <Badge
                    variant={invoice.status === 'overdue' ? 'destructive' : 'secondary'}
                  >
                    {invoice.status === 'overdue' ? 'Vencida' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
