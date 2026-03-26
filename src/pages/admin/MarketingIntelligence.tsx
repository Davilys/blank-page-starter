import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, Settings, Users, Brain, Megaphone, Activity, Target,
} from 'lucide-react';
import MarketingOverview from '@/components/admin/marketing/MarketingOverview';
import MetaAdsConfig from '@/components/admin/marketing/MetaAdsConfig';
import CampaignTable from '@/components/admin/marketing/CampaignTable';
import AttributionPanel from '@/components/admin/marketing/AttributionPanel';
import AudienceExport from '@/components/admin/marketing/AudienceExport';
import MarketingAlerts from '@/components/admin/marketing/MarketingAlerts';
import ConversionFunnelModule from '@/components/admin/marketing/ConversionFunnelModule';
import CampaignPrediction from '@/components/admin/marketing/CampaignPrediction';
import LeadScoringModule from '@/components/admin/marketing/LeadScoringModule';
import PixelEventTracking from '@/components/admin/marketing/PixelEventTracking';
import BudgetControl from '@/components/admin/marketing/BudgetControl';
import ConversionsTracker from '@/components/admin/marketing/ConversionsTracker';
import AdPerformanceHistory from '@/components/admin/marketing/AdPerformanceHistory';
import HeatmapModule from '@/components/admin/marketing/HeatmapModule';
import AdCopyGenerator from '@/components/admin/marketing/AdCopyGenerator';
import ABTestManager from '@/components/admin/marketing/ABTestManager';
import AudienceSuggester from '@/components/admin/marketing/AudienceSuggester';
import OptimizationAgent from '@/components/admin/marketing/OptimizationAgent';
import { Separator } from '@/components/ui/separator';

export default function MarketingIntelligence() {
  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">
            CRM + Growth Marketing + BI de Anúncios — Análise e otimização completa com IA
          </p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
              <Megaphone className="h-3.5 w-3.5" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" />
              Análise
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5 text-xs">
              <Target className="h-3.5 w-3.5" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="audiences" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Públicos
            </TabsTrigger>
            <TabsTrigger value="agent" className="gap-1.5 text-xs">
              <Brain className="h-3.5 w-3.5" />
              Agente IA
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" />
              Config
            </TabsTrigger>
          </TabsList>

          {/* Dashboard = Overview + Budget + Alerts */}
          <TabsContent value="overview">
            <div className="space-y-6">
              <MarketingOverview />
              <Separator />
              <BudgetControl />
              <Separator />
              <MarketingAlerts />
            </div>
          </TabsContent>

          {/* Campanhas = Table + Histórico */}
          <TabsContent value="campaigns">
            <div className="space-y-6">
              <CampaignTable />
              <Separator />
              <AdPerformanceHistory />
            </div>
          </TabsContent>

          {/* Análise = Conversões + Funil + Atribuição + Eventos */}
          <TabsContent value="analysis">
            <div className="space-y-6">
              <ConversionsTracker />
              <Separator />
              <ConversionFunnelModule />
              <Separator />
              <AttributionPanel />
              <Separator />
              <PixelEventTracking />
            </div>
          </TabsContent>

          {/* Leads = Scoring + Heatmap */}
          <TabsContent value="leads">
            <div className="space-y-6">
              <LeadScoringModule />
              <Separator />
              <HeatmapModule />
            </div>
          </TabsContent>

          {/* Públicos = Export + IA Suggester */}
          <TabsContent value="audiences">
            <div className="space-y-6">
              <AudienceExport />
              <Separator />
              <AudienceSuggester />
            </div>
          </TabsContent>

          {/* Agente IA = Otimização + Gerador + A/B + Previsão */}
          <TabsContent value="agent">
            <div className="space-y-6">
              <OptimizationAgent />
              <Separator />
              <AdCopyGenerator />
              <Separator />
              <ABTestManager />
              <Separator />
              <CampaignPrediction />
            </div>
          </TabsContent>

          {/* Config = Meta only */}
          <TabsContent value="config">
            <MetaAdsConfig />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
