import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const name = pathname.split('/').filter(Boolean).pop() ?? 'Page';
  const title = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Construction size={28} className="text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">This section is under development.</p>
    </div>
  );
}
