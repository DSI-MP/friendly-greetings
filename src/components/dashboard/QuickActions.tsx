import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface Action {
  label: string;
  icon: LucideIcon;
  to: string;
  variant?: 'default' | 'outline' | 'secondary';
}

interface QuickActionsProps {
  actions: Action[];
}

export default function QuickActions({ actions }: QuickActionsProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="saas-card p-5"
    >
      <h3 className="mb-4 text-sm font-bold text-foreground">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant ?? 'outline'}
            className="h-auto flex-col gap-2.5 py-5 text-xs rounded-xl border-border hover:border-primary/30 hover:shadow-sm transition-all duration-200"
            onClick={() => navigate(action.to)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <action.icon size={16} className="text-primary" />
            </div>
            <span className="font-medium">{action.label}</span>
          </Button>
        ))}
      </div>
    </motion.div>
  );
}
