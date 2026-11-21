"use client";

import { useState } from "react";
import { ActiveBadge } from "@/components/common/badges";
import { NativeSelect } from "@/components/common/native-select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, LoadingState, StatusMessage } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResource } from "@/hooks/use-resource";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { INSTITUTION_ROLES, type InstitutionRole, type User } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { UserFormDialog } from "./user-form-dialog";

export const PAGE_SIZE = 10;

/** /admin/usuarios — usuários e papéis da instituição (TA-002, TA-006, TA-007). */
export function UsersManager() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<InstitutionRole | "">("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);

  const query = { search: search || undefined, role: role || undefined, page, pageSize: PAGE_SIZE };
  const users = useResource(
    () => getServices().users.list(query),
    `users:${JSON.stringify(query)}`,
  );
  const totalPages = Math.max(1, Math.ceil((users.data?.total ?? 0) / PAGE_SIZE));

  async function update(
    user: User,
    input: { role?: InstitutionRole; active?: boolean },
    ok: (u: User) => string,
  ) {
    setMessage(null);
    try {
      const saved = await getServices().users.update(user.id, input);
      setMessage({ kind: "ok", text: ok(saved) });
      if (users.data)
        users.setData({
          ...users.data,
          items: users.data.items.map((u) => (u.id === saved.id ? saved : u)),
        });
    } catch (e) {
      setMessage({ kind: "erro", text: errorMessage(e) });
      users.reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Usuários e papéis"
        description="Cadastre professores e alunos da instituição, altere papéis e desative acessos."
        actions={<Button onClick={() => setOpen(true)}>Novo usuário</Button>}
      />
      <form
        role="search"
        aria-label="Filtrar usuários"
        className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="busca-usuarios">Buscar por nome ou e-mail</Label>
          <Input
            id="busca-usuarios"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filtro-papel">Filtrar por papel</Label>
          <NativeSelect
            id="filtro-papel"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as InstitutionRole | "");
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {INSTITUTION_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </form>
      <StatusMessage message={message} />
      {users.error ? (
        <ErrorState error={users.error} onRetry={users.reload} />
      ) : !users.data ? (
        <LoadingState />
      ) : users.data.items.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado." />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Usuários da instituição">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <NativeSelect
                      aria-label={`Papel de ${u.name}`}
                      className="w-48"
                      value={u.role}
                      onChange={(e) =>
                        update(
                          u,
                          { role: e.target.value as InstitutionRole },
                          (s) => `${s.name} agora é ${ROLE_LABELS[s.role]}.`,
                        )
                      }
                    >
                      {INSTITUTION_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={u.active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`${u.active ? "Desativar" : "Reativar"} ${u.name}`}
                      onClick={() =>
                        update(
                          u,
                          { active: !u.active },
                          (s) => `${s.name}: acesso ${s.active ? "reativado" : "desativado"}.`,
                        )
                      }
                    >
                      {u.active ? "Desativar" : "Reativar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          Página {page} de {totalPages} · {users.data?.total ?? 0} usuário(s)
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </nav>
      <UserFormDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(u) => {
          setOpen(false);
          setMessage({ kind: "ok", text: `${u.name} cadastrado(a) como ${ROLE_LABELS[u.role]}.` });
          users.reload();
        }}
      />
    </>
  );
}
