import { motion } from 'framer-motion';
import { AnimatedCounter } from './AnimatedCounter';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  gradient: string;
  index: number;
  onClick?: () => void;
  isActive?: boolean;
}

export function StatsCard({
  title, value, prefix = '', suffix = '',
  icon: Icon, trend, trendLabel, gradient, index, onClick, isActive
}: StatsCardProps) {
  const isPos = (trend ?? 0) > 0;
  const isNeg = (trend ?? 0) < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.97 }}
      className="group relative cursor-pointer"
      onClick={onClick}
    >
      <div className={cn("relative rounded-2xl overflow-hidden bg-card border shadow-sm dark:bg-white/[0.03] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200", isActive ? 'border-primary ring-2 ring-primary/30 shadow-md' : 'border-border dark:border-white/[0.08]')}>
        <div className={cn('absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r', gradient)} />

        <div className="p-4 relative z-10">
          <motion.div
            className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg mb-3', gradient)}
            whileHover={{ rotate: 8, scale: 1.12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Icon className="h-4 w-4 text-white" />
          </motion.div>

          <p className="text-2xl font-black tracking-tight text-foreground leading-none">
            <AnimatedCounter value={value} prefix={prefix} suffix={suffix} />
          </p>
          <p className="text-[11px] font-medium text-muted-foreground mt-1">{title}</p>

          {trend !== undefined && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.07 }}
              className="flex items-center gap-1 mt-2 pt-2 border-t border-border dark:border-white/[0.06]"
            >
              {isPos && <TrendingUp className="h-3 w-3 text-emerald-500" />}
              {isNeg && <TrendingDown className="h-3 w-3 text-rose-500" />}
              <span className={cn('text-[11px] font-bold',
                isPos ? 'text-emerald-500' : isNeg ? 'text-rose-500' : 'text-muted-foreground'
              )}>
                {isPos && '+'}{trend}%
              </span>
              {trendLabel && <span className="text-[10px] text-muted-foreground">{trendLabel}</span>}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
