import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type DateFilterType = 'all' | 'today' | 'week' | 'month';

interface DatePeriodFilterProps {
  dateFilter: DateFilterType;
  onDateFilterChange: (filter: DateFilterType) => void;
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function DatePeriodFilter({
  dateFilter,
  onDateFilterChange,
  selectedMonth,
  onMonthChange
}: DatePeriodFilterProps) {
  const monthLabel = format(selectedMonth, "MMM 'de' yyyy", { locale: ptBR });
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Filtros rápidos */}
      <div className="flex items-center border rounded-lg bg-background overflow-hidden">
        <Button
          variant={dateFilter === 'today' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none"
          onClick={() => onDateFilterChange(dateFilter === 'today' ? 'all' : 'today')}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Hoje
        </Button>
        <Button
          variant={dateFilter === 'week' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-l"
          onClick={() => onDateFilterChange(dateFilter === 'week' ? 'all' : 'week')}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Semana
        </Button>
        <Button
          variant={dateFilter === 'month' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-l"
          onClick={() => onDateFilterChange(dateFilter === 'month' ? 'all' : 'month')}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Mês
        </Button>
      </div>
      
      {/* Navegador de mês */}
      <div className="flex items-center border rounded-lg bg-background">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-r-none"
          onClick={() => onMonthChange(subMonths(selectedMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 text-sm font-medium capitalize min-w-[120px] text-center">
          {monthLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-l-none"
          onClick={() => onMonthChange(addMonths(selectedMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
