import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, FileText } from 'lucide-react';
import { NotificationAnalyticsDashboard } from './NotificationAnalyticsDashboard';
import { NotificationTemplatesManager } from './NotificationTemplatesManager';

export function NotificationSettings() {
  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList>
        <TabsTrigger value="dashboard" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Dashboard
        </TabsTrigger>
        <TabsTrigger value="templates" className="gap-2">
          <FileText className="h-4 w-4" />
          Templates
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        <NotificationAnalyticsDashboard />
      </TabsContent>

      <TabsContent value="templates">
        <NotificationTemplatesManager />
      </TabsContent>
    </Tabs>
  );
}
