"use client";

import type { ComponentProps } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Shared = { error?: string; label: string };

/** A labelled shadcn input with its validation message underneath. */
export function FormField({ error, label, ...props }: Shared & ComponentProps<"input">) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <Input aria-invalid={error ? true : undefined} {...props} />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/** The multi-line version of FormField. */
export function FormTextarea({ error, label, ...props }: Shared & ComponentProps<"textarea">) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <Textarea aria-invalid={error ? true : undefined} {...props} />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
