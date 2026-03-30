import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MapPin, Loader2, Check } from 'lucide-react';

export interface PlaceOption {
  id: number;
  title: string;
  address?: string;
  latitude: number;
  longitude: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  currentLocation?: string;
  places: PlaceOption[];
  placesLoading: boolean;
  onSave: (place: PlaceOption) => Promise<void>;
}

export default function LocationEditDialog({ open, onClose, employeeName, currentLocation, places, placesLoading, onSave }: Props) {
  const [search, setSearch] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceOption | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedPlace(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return places;
    const q = search.toLowerCase();
    return places.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q)
    );
  }, [places, search]);

  const handleSave = async () => {
    if (!selectedPlace) return;
    setSaving(true);
    try {
      await onSave(selectedPlace);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Location — {employeeName}</DialogTitle>
        </DialogHeader>

        {currentLocation && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Current: <Badge variant="secondary">{currentLocation}</Badge>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search places…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[280px] rounded-md border">
          {placesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading places…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <MapPin className="h-8 w-8 mb-2 opacity-40" />
              No places found
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(place => {
                const isSelected = selectedPlace?.id === place.id;
                return (
                  <button
                    key={place.id}
                    onClick={() => setSelectedPlace(place)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-accent/50 ${
                      isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''
                    }`}
                  >
                    <MapPin className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {place.title}
                      </p>
                      {place.address && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{place.address}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {Number(place.latitude ?? 0).toFixed(5)}, {Number(place.longitude ?? 0).toFixed(5)}
                      </p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!selectedPlace || saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MapPin className="mr-1.5 h-4 w-4" />}
            Save Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
