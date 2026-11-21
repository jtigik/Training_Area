"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { errorMessage } from "@/components/common/page-states";
import { api, LEVEL_LABELS, type Concept, type KnowledgeLevel } from "@/lib/api";

/** "Refazer nível" — unlimited, only rendered by callers while the BEST concept is ND or ED. */
export function RetakeLevelButton({
  level,
  concept,
  onDone,
  variant = "outline",
}: {
  level: KnowledgeLevel;
  concept: Concept;
  onDone: () => void;
  variant?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.retakeLevel(level);
      setOpen(false);
      onDone();
    } catch (e) {
      setError(errorMessage(e, "Não foi possível reiniciar o nível. Tente de novo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} data-testid="redo-button">
          <RotateCcw aria-hidden="true" />
          Refazer nível
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refazer o nível {LEVEL_LABELS[level]}?</DialogTitle>
          <DialogDescription>
            Seu melhor conceito é {concept}. Ao refazer, você recebe uma nova rodada de exercícios e
            um novo conceito será calculado quando concluir. Vale sempre o melhor conceito entre as
            tentativas, e o próximo nível é liberado com D ou PD.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={() => void confirm()} disabled={busy} aria-busy={busy}>
            {busy ? "Reiniciando…" : "Refazer nível"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
