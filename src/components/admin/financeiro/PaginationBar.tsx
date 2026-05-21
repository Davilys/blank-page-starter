import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PageSize = number | "all";

interface PaginationBarProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: PageSize) => void;
}

export function PaginationBar({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationBarProps) {
  const isAll = pageSize === "all";
  const size = isAll ? Math.max(total, 1) : (pageSize as number);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * size + 1;
  const end = isAll ? total : Math.min(currentPage * size, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t bg-muted/20">
      <div className="text-xs text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{start}</span>–
        <span className="font-medium text-foreground">{end}</span> de{" "}
        <span className="font-medium text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Itens por página</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(v === "all" ? "all" : Number(v))}
        >
          <SelectTrigger className="h-8 w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!isAll && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Página <span className="font-medium text-foreground">{currentPage}</span> de{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
