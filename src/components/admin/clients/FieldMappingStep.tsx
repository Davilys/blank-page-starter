import React from 'react';
import { ArrowRight, Check, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SYSTEM_FIELDS, type FieldMapping } from '@/lib/clientParser';
import { cn } from '@/lib/utils';

interface FieldMappingStepProps {
  headers: string[];
  mapping: FieldMapping;
  onMappingChange: (mapping: FieldMapping) => void;
  sampleData?: Record<string, unknown>;
}

export function FieldMappingStep({ 
  headers, 
  mapping, 
  onMappingChange,
  sampleData 
}: FieldMappingStepProps) {
  
  const handleFieldChange = (fileColumn: string, systemField: string | null) => {
    onMappingChange({
      ...mapping,
      [fileColumn]: systemField === '_ignore' ? null : systemField,
    });
  };

  // Check which required fields are mapped
  const requiredFields = SYSTEM_FIELDS.filter(f => f.required);
  const mappedSystemFields = Object.values(mapping).filter(Boolean);
  const missingRequired = requiredFields.filter(f => !mappedSystemFields.includes(f.key));

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center gap-4">
        {missingRequired.length > 0 ? (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              Campos obrigatórios não mapeados: {missingRequired.map(f => f.label).join(', ')}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-4 w-4" />
            <span className="text-sm">Todos os campos obrigatórios estão mapeados</span>
          </div>
        )}
      </div>

      {/* Mapping table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 border-b">
          <div className="grid grid-cols-3 gap-4 text-sm font-medium">
            <div>Coluna do Arquivo</div>
            <div className="text-center">Mapear Para</div>
            <div>Campo do Sistema</div>
          </div>
        </div>

        <div className="divide-y max-h-[400px] overflow-y-auto">
          {headers.map((header) => {
            const currentMapping = mapping[header];
            const systemField = SYSTEM_FIELDS.find(f => f.key === currentMapping);
            const sampleValue = sampleData?.[header];

            return (
              <div key={header} className="px-4 py-3">
                <div className="grid grid-cols-3 gap-4 items-center">
                  {/* File column */}
                  <div>
                    <p className="font-medium text-sm">{header}</p>
                    {sampleValue !== undefined && sampleValue !== '' && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                        Ex: {String(sampleValue)}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <ArrowRight className={cn(
                      "h-4 w-4",
                      currentMapping ? "text-primary" : "text-muted-foreground/50"
                    )} />
                  </div>

                  {/* System field selector */}
                  <div className="flex items-center gap-2">
                    <Select
                      value={currentMapping || '_ignore'}
                      onValueChange={(value) => handleFieldChange(header, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Ignorar campo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_ignore">
                          <span className="text-muted-foreground">Ignorar campo</span>
                        </SelectItem>
                        {SYSTEM_FIELDS.map((field) => {
                          const isUsed = Object.values(mapping).includes(field.key) && mapping[header] !== field.key;
                          return (
                            <SelectItem 
                              key={field.key} 
                              value={field.key}
                              disabled={isUsed}
                            >
                              <span className={isUsed ? 'text-muted-foreground' : ''}>
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                                {isUsed && ' (já usado)'}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {systemField?.required && currentMapping && (
                      <Badge variant="outline" className="border-green-500 text-green-600 shrink-0">
                        Obrigatório
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="text-destructive">*</span> Campo obrigatório
        </span>
        <span>• Campos não mapeados serão ignorados na importação</span>
      </div>
    </div>
  );
}
