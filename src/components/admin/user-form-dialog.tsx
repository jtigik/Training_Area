"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field } from "@/components/common/field";
import { NativeSelect } from "@/components/common/native-select";
import { collectErrorMessages, FormErrorSummary } from "@/components/common/form-error-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { INSTITUTION_ROLES, type User } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { userFormSchema, type UserFormValues } from "@/lib/validation/schemas";

/** Diálogo de novo usuário da instituição (nome, e-mail e papel). */
export function UserFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: User) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: "", email: "", role: "STUDENT" },
  });
  const { register, handleSubmit, formState, reset } = form;

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await getServices().users.create(values);
      reset();
      onCreated(user);
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  const messages = [
    ...collectErrorMessages(formState.errors),
    ...(serverError ? [serverError] : []),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setServerError(null);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            A pessoa entra com a conta Google ou Microsoft deste e-mail.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <FormErrorSummary messages={messages} />
          <Field label="Nome" required error={formState.errors.name?.message}>
            <Input autoComplete="off" {...register("name")} />
          </Field>
          <Field label="E-mail" required error={formState.errors.email?.message}>
            <Input type="email" autoComplete="off" {...register("email")} />
          </Field>
          <Field label="Papel" required error={formState.errors.role?.message}>
            <NativeSelect {...register("role")}>
              {INSTITUTION_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
