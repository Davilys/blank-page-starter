import { Smartphone } from 'lucide-react';
import { BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChannelAnalyticsDashboard } from './ChannelAnalyticsDashboard';
import { ChannelNotificationTemplates } from './ChannelNotificationTemplates';

export function AutomatedSMSSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/20">
          <Smartphone className="h-5 w-5 text-cyan-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">SMS Relatórios</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os templates e acompanhe o desempenho dos SMS relatórios via Zenvia
          </p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Smartphone className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <ChannelAnalyticsDashboard channel="sms" />
        </TabsContent>

        <TabsContent value="templates">
          <ChannelNotificationTemplates channel="sms" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
