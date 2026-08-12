import { Check, CalendarRange, Users, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  sellers: string[];
  selected: string[];
  onToggleSeller: (s: string) => void;
  onReset: () => void;
};

export function Filters({
  start,
  end,
  onStart,
  onEnd,
  sellers,
  selected,
  onToggleSeller,
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          <CalendarRange className="mr-1 inline size-3.5" />
          Data inicial
        </Label>
        <Input
          type="date"
          value={start}
          onChange={(e) => onStart(e.target.value)}
          className="w-[10.5rem]"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Data final</Label>
        <Input
          type="date"
          value={end}
          onChange={(e) => onEnd(e.target.value)}
          className="w-[10.5rem]"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="block text-xs font-medium text-muted-foreground">
          <Users className="mr-1 inline size-3.5" />
          Vendedoras
        </Label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[14rem] justify-between font-normal">
              {selected.length === 0 || selected.length === sellers.length
                ? "Todas as vendedoras"
                : `${selected.length} selecionada(s)`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[14rem]">
            {sellers.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={(e) => {
                  e.preventDefault();
                  onToggleSeller(s);
                }}
                className="justify-between"
              >
                {s}
                {selected.includes(s) && <Check className="size-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button variant="ghost" onClick={onReset} className="text-muted-foreground">
        <RotateCcw className="size-4" />
        Limpar
      </Button>

      {selected.length > 0 && selected.length < sellers.length && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <Badge
              key={s}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => onToggleSeller(s)}
            >
              {s} ✕
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
