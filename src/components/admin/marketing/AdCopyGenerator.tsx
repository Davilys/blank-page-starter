import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, Copy, Save, Wand2, FileText } from 'lucide-react';

interface GeneratedAd {
  headline: string;
  primary_text: string;
  description: string;
  call_to_action: string;
}

export default function AdCopyGenerator() {
  const queryClient = useQueryClient();
  const [campaignName, setCampaignName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [objective, setObjective] = useState('leads');
  const [platform, setPlatform] = useState('meta');
  const [generating, setGenerating] = useState(false);
  const [generatedAds, setGeneratedAds] = useState<GeneratedAd[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  const generateAds = async () => {
    setGenerating(true);
    setGeneratedAds([]);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-ai-agent', {
        body: {
          action: 'generate_ad',
          campaign_name: campaignName || 'Registro de Marcas',
          target_audience: targetAudience || 'Empreendedores e donos de empresas',
          objective,
          platform,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data?.data;
      if (result) {
        const ads: GeneratedAd[] = [
          {
            headline: result.headline || '',
            primary_text: result.primary_text || '',
            description: result.description || '',
            call_to_action: result.call_to_action || '',
          },
          ...(result.variations || []),
        ];
        setGeneratedAds(ads);
        toast.success(`${ads.length} anúncios gerados com sucesso!`);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const saveAd = async (ad: GeneratedAd, index: number) => {
    setSaving(index);
    try {
      const { error } = await supabase.from('marketing_generated_ads').insert({
        campaign_name: campaignName || 'Registro de Marcas',
        platform,
        target_audience: targetAudience,
        objective,
        headline: ad.headline,
        primary_text: ad.primary_text,
        description: ad.description || null,
        call_to_action: ad.call_to_action || null,
      } as any);
      if (error) throw error;
      toast.success('Anúncio salvo com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const copyToClipboard = (ad: GeneratedAd) => {
    const text = `Título: ${ad.headline}\nTexto: ${ad.primary_text}\nDescrição: ${ad.description}\nCTA: ${ad.call_to_action}`;
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Gerador de Anúncios com IA
          </CardTitle>
          <CardDescription>
            Gere anúncios otimizados para Meta Ads usando inteligência artificial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Campanha</Label>
              <Input
                placeholder="Ex: Registro de Marcas 2026"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Público-Alvo</Label>
              <Input
                placeholder="Ex: Empreendedores, MEIs, Startups"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta Ads (Facebook/Instagram)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select value={objective} onValueChange={setObjective}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leads">Geração de Leads</SelectItem>
                  <SelectItem value="conversions">Conversões</SelectItem>
                  <SelectItem value="awareness">Reconhecimento</SelectItem>
                  <SelectItem value="traffic">Tráfego</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={generateAds} disabled={generating} size="lg" className="w-full md:w-auto">
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? 'Gerando anúncios...' : 'Gerar Anúncios com IA'}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Ads */}
      {generatedAds.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Anúncios Gerados ({generatedAds.length})
          </h3>
          {generatedAds.map((ad, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-xs">
                    {i === 0 ? 'Principal' : `Variação ${i}`}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(ad)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => saveAd(ad, i)} disabled={saving === i}>
                      {saving === i ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                      Salvar
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Título</p>
                    <p className="text-base font-bold text-foreground mt-0.5">{ad.headline}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Texto Principal</p>
                    <p className="text-sm text-foreground mt-0.5">{ad.primary_text}</p>
                  </div>
                  {ad.description && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Descrição</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{ad.description}</p>
                    </div>
                  )}
                  {ad.call_to_action && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Call to Action</p>
                      <Badge className="mt-1">{ad.call_to_action}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
