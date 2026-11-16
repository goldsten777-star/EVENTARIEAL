import { z } from "zod";
import { Constants } from "@/types/database";

const int = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `יש להזין ${label}` })
    .regex(/^\d+$/, { error: `${label}: יש להזין מספר שלם` })
    .transform(Number)
    .pipe(z.number().min(min, { error: `${label}: לפחות ${min}` }).max(max, { error: `${label}: עד ${max}` }));

export const tableSchema = z
  .object({
    number: int("מספר שולחן", 1, 999),
    count: int("כמות", 1, 50),
    name: z
      .string()
      .trim()
      .max(60, { error: "השם ארוך מדי (עד 60 תווים)" })
      .transform((v) => (v === "" ? null : v)),
    capacity: int("מקומות", 1, 100),
    shape: z.enum(Constants.public.Enums.table_shape, { error: "יש לבחור צורה" }),
  })
  .superRefine((d, ctx) => {
    if (d.number + d.count - 1 > 999) {
      ctx.addIssue({ code: "custom", path: ["count"], message: "מספרי השולחנות יעברו את 999" });
    }
  });

export function tableFormInput(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  return { number: s("number"), count: s("count") || "1", name: s("name"), capacity: s("capacity"), shape: s("shape") };
}
