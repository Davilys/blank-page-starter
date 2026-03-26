import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SettingsCardProps {
  icon: LucideIcon;
  iconColor?: string;
  iconGlow?: string;
  title: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
  /** @deprecated use badgeColor instead */
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  children: React.ReactNode;
  className?: string;
  index?: number;
}

export function SettingsCard({
  icon: Icon,
  iconColor = 'hsl(var(--primary))',
  iconGlow = 'hsl(var(--primary) / 0.2)',
  title,
  description,
  badge,
  badgeColor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  badgeVariant,
  children,
  className,
  index = 0,
}: SettingsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: index * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={cn(
        'group relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden',
        'shadow-[0_4px_24px_hsl(var(--foreground)/0.04)] hover:shadow-[0_8px_32px_hsl(var(--foreground)/0.08)]',
        'transition-shadow duration-300',
        className
      )}
    >
      {/* Top glow line — appears on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `linear-gradient(90deg, transparent, ${iconColor}, transparent)` }}
      />

      {/* Corner radial glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: iconGlow }}
      />

      <div className="relative p-5 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 8, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: iconGlow,
                border: `1px solid ${iconColor}35`,
              }}
            >
              <Icon className="h-5 w-5" style={{ color: iconColor }} />
            </motion.div>
            <div>
              <h3 className="font-bold text-foreground text-base leading-tight">{title}</h3>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
              )}
            </div>
          </div>
          {badge && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
              style={badgeColor ? {
                background: `${badgeColor}20`,
                border: `1px solid ${badgeColor}40`,
                color: badgeColor,
              } : {
                background: 'hsl(var(--primary) / 0.15)',
                border: '1px solid hsl(var(--primary) / 0.3)',
                color: 'hsl(var(--primary))',
              }}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/40 mb-5" />

        {/* Content */}
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
