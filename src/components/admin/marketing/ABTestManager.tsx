import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FlaskConical, Plus, Trophy, Loader2, BarChart3 } from 'lucide-react';

export default function ABTestManager() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [testName, setTestName] = useState('');
  const [variants, setVariants] = useState([
    { name: 'Variante A', headline: '', primary_text: '' },
    { name: 'Variante B', headline: '', primary_text: '' },
  ]);

  const { data: tests = [] } = useQuery({
    queryKey: ['ab-tests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_ab_tests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) return [];
      return data || [];
    },
  });

  const { data: allVariants = [] } = useQuery({
    queryKey: ['ab-variants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_ab_variants')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) return [];
      return data || [];
    },
  });

  const createTest = useMutation({
    mutationFn: async () => {
      const { data: test, error: testError } = await supabase
        .from('marketing_ab_tests')
        .insert({ test_name: testName } as any)
        .select()
        .single();
      if (testError) throw testError;

      for (const v of variants) {
        if (!v.headline.trim()) continue;
        const { error: vError } = await supabase
          .from('marketing_ab_variants')
          .insert({
            test_id: test.id,
            variant_name: v.name,
            headline: v.headline,
            primary_text: v.primary_text,
          } as any);
        if (vError) throw vError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      queryClient.invalidateQueries({ queryKey: ['ab-variants'] });
      toast.success('Teste A/B criado com sucesso!');
      setShowCreate(false);
      setTestName('');
      setVariants([
        { name: 'Variante A', headline: '', primary_text: '' },
        { name: 'Variante B', headline: '', primary_text: '' },
      ]);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addVariant = () => {
    const letter = String.fromCharCode(65 + variants.length);
    setVariants([...variants, { name: `Variante ${letter}`, headline: '', primary_text: '' }]);
  };

  const getTestVariants = (testId: string) => allVariants.filter(v => v.test_id === testId);

  const getWinner = (testVariants: any[]) => {
    if (testVariants.length === 0) return null;
    return testVariants.reduce((best, v) => {
      const bestScore = Number(best.leads || 0) > 0 ? Number(best.leads) / Math.max(Number(best.spend || 1), 1) : 0;
      const vScore = Number(v.leads || 0) > 0 ? Number(v.leads) / Math.max(Number(v.spend || 1), 1) : 0;
      return vScore > bestScore ? v : best;
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                Teste A/B de Criativos
              </CardTitle>
              <CardDescription>
                Compare múltiplas variações de anúncios e identifique o melhor criativo
              </CardDescription>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Novo Teste
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Teste A/B</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nome do Teste</Label>
                    <Input
                      placeholder="Ex: Teste headline - Março 2026"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                    />
                  </div>

                  {variants.map((v, i) => (
                    <Card key={i} className="border-border/50">
                      <CardContent className="p-4 space-y-3">
                        <p className="font-semibold text-sm">{v.name}</p>
                        <div className="space-y-2">
                          <Label className="text-xs">Título</Label>
                          <Input
                            placeholder="Título do anúncio"
                            value={v.headline}
                            onChange={(e) => {
                              const updated = [...variants];
                              updated[i].headline = e.target.value;
                              setVariants(updated);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Texto Principal</Label>
                          <Input
                            placeholder="Texto do anúncio"
                            value={v.primary_text}
                            onChange={(e) => {
                              const updated = [...variants];
                              updated[i].primary_text = e.target.value;
                              setVariants(updated);
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addVariant}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar Variante
                    </Button>
                  </div>

                  <Button
                    onClick={() => createTest.mutate()}
                    disabled={!testName.trim() || createTest.isPending}
                    className="w-full"
                  >
                    {createTest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Criar Teste A/B
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Active Tests */}
      {tests.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FlaskConical className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Nenhum teste A/B criado</p>
              <p className="text-sm mt-1">Crie um teste para comparar variações de anúncios</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        tests.map((test) => {
          const testVars = getTestVariants(test.id);
          const winner = getWinner(testVars);
          return (
            <Card key={test.id} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{test.test_name}</CardTitle>
                    <Badge variant={test.status === 'running' ? 'default' : 'secondary'}>
                      {test.status === 'running' ? 'Em andamento' : test.status === 'completed' ? 'Concluído' : test.status}
                    </Badge>
                  </div>
                  {winner && Number(winner.leads || 0) > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                      <Trophy className="h-3 w-3" />
                      Líder: {winner.variant_name}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {testVars.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variante</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="text-right">Impressões</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">CPL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {testVars.map((v) => (
                        <TableRow key={v.id} className={winner?.id === v.id ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                          <TableCell className="font-medium text-sm">
                            {v.variant_name}
                            {winner?.id === v.id && Number(v.leads || 0) > 0 && (
                              <Trophy className="h-3 w-3 text-emerald-500 inline ml-1" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{v.headline || '—'}</TableCell>
                          <TableCell className="text-right text-sm">{Number(v.impressions || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm">{Number(v.clicks || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm">{Number(v.ctr || 0).toFixed(2)}%</TableCell>
                          <TableCell className="text-right text-sm font-medium">{v.leads || 0}</TableCell>
                          <TableCell className="text-right text-sm">R$ {Number(v.cpl || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem variantes registradas</p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
