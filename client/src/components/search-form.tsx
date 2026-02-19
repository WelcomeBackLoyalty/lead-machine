import { useState } from "react";
import { Search, Sparkles, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  defaultRequest: string;
  defaultCount: number;
  isCreating: boolean;
  onSubmit: (request: string, count: number, refine: boolean) => void;
};

export function SearchForm({
  defaultRequest,
  defaultCount,
  isCreating,
  onSubmit,
}: Props) {
  const [request, setRequest] = useState(defaultRequest);
  const [count, setCount] = useState(String(defaultCount));
  const [refine, setRefine] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = request.trim();
    if (!trimmed) return;
    onSubmit(trimmed, Number(count) || 250, refine);
  };

  return (
    <Card className="glass-card animate-fade-in stagger-1">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          New Search
        </CardTitle>
        <CardDescription>
          Describe the leads you're looking for in natural language
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Find me contacts for owners of landscaping companies in Texas..."
            rows={4}
            className="resize-none border-border/50 bg-background/50 placeholder:text-muted-foreground/40 focus-visible:ring-emerald-500/50"
          />

          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Target count
              </label>
              <Input
                type="number"
                min={10}
                max={1000}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-28 border-border/50 bg-background/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="refine-toggle"
                checked={refine}
                onCheckedChange={setRefine}
                className="data-[state=checked]:bg-emerald-600"
              />
              <Label
                htmlFor="refine-toggle"
                className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
              >
                <BrainCircuit className="h-3.5 w-3.5" />
                Refine with AI
              </Label>
            </div>

            <Button
              type="submit"
              disabled={isCreating || !request.trim()}
              className="glow-hover gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <Search className="h-4 w-4" />
              {isCreating ? "Starting..." : "Start Search"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
