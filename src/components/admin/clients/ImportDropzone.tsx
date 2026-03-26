import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, FileCode, File, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ImportDropzoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  accept?: string;
}

const ACCEPTED_FORMATS = {
  'text/csv': { icon: FileText, label: 'CSV', color: 'text-green-600' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileSpreadsheet, label: 'XLSX', color: 'text-emerald-600' },
  'application/vnd.ms-excel': { icon: FileSpreadsheet, label: 'XLS', color: 'text-emerald-600' },
  'application/xml': { icon: FileCode, label: 'XML', color: 'text-orange-600' },
  'text/xml': { icon: FileCode, label: 'XML', color: 'text-orange-600' },
  'application/pdf': { icon: File, label: 'PDF', color: 'text-red-600' },
};

export function ImportDropzone({ onFileSelect, isLoading = false, accept }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const getFileInfo = (file: File) => {
    const format = ACCEPTED_FORMATS[file.type as keyof typeof ACCEPTED_FORMATS];
    if (format) return format;
    
    // Fallback based on extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv': return ACCEPTED_FORMATS['text/csv'];
      case 'xlsx': return ACCEPTED_FORMATS['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      case 'xls': return ACCEPTED_FORMATS['application/vnd.ms-excel'];
      case 'xml': return ACCEPTED_FORMATS['application/xml'];
      case 'pdf': return ACCEPTED_FORMATS['application/pdf'];
      default: return { icon: File, label: 'Arquivo', color: 'text-gray-600' };
    }
  };

  if (selectedFile) {
    const fileInfo = getFileInfo(selectedFile);
    const FileIcon = fileInfo.icon;
    
    return (
      <div className="border-2 border-dashed border-primary/50 rounded-lg p-6 bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-background", fileInfo.color)}>
              <FileIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {fileInfo.label} • {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Button variant="ghost" size="icon" onClick={clearFile}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
        isDragging 
          ? "border-primary bg-primary/5" 
          : "border-muted-foreground/25 hover:border-primary/50"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        className="hidden"
        accept={accept || ".csv,.xlsx,.xls,.xml,.pdf"}
        onChange={handleFileInput}
      />
      
      <div className="flex flex-col items-center gap-3">
        <div className="p-4 bg-muted rounded-full">
          <Upload className="h-8 w-8 text-muted-foreground" />
        </div>
        
        <div>
          <p className="font-medium">
            Arraste um arquivo ou <span className="text-primary">clique para selecionar</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Formatos suportados: CSV, Excel (XLSX/XLS), XML, PDF
          </p>
        </div>
        
        <div className="flex items-center gap-4 mt-2">
          {Object.entries(ACCEPTED_FORMATS).slice(0, 4).map(([type, info]) => {
            const Icon = info.icon;
            return (
              <div key={type} className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon className={cn("h-4 w-4", info.color)} />
                <span>{info.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
