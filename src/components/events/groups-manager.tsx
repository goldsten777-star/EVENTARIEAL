"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteGroup, saveGroup } from "@/features/events/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { initialFormState } from "@/lib/form-state";
import { GROUP_COLORS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type GroupRow = { id: string; name: string; color: string; guestCount: number };

function GroupForm({
  eventId,
  group,
  onDone,
}: {
  eventId: string;
  group?: GroupRow;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveGroup.bind(null, eventId, group?.id ?? null), initialFormState);
  const [color, setColor] = useState(group?.color ?? GROUP_COLORS[0]);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-5">
      {!state.ok ? <FormAlert message={state.fieldErrors ? undefined : state.message} /> : null}
      <TextField
        label="שם הקבוצה"
        name="name"
        defaultValue={state.values?.name ?? group?.name}
        errors={state.fieldErrors?.name}
        maxLength={60}
        required
        autoFocus
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">צבע</legend>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-2">
          {GROUP_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`צבע ${c}`}
              aria-pressed={color === c}
              className={cn(
                "size-9 rounded-full border-2 border-transparent outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                color === c && "border-foreground",
              )}
            >
              <span className="block size-full rounded-full border-2 border-background" style={{ background: c }} />
            </button>
          ))}
        </div>
      </fieldset>
      <SubmitButton pendingText="שומרים…">{group ? "שמירה" : "הוספת קבוצה"}</SubmitButton>
    </form>
  );
}

function GroupDialog({ eventId, group }: { eventId: string; group?: GroupRow }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {group ? (
          <Button variant="ghost" size="icon" aria-label={`עריכת הקבוצה ${group.name}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline">
            <PlusIcon aria-hidden="true" /> קבוצה חדשה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{group ? "עריכת קבוצה" : "קבוצה חדשה"}</DialogTitle>
          <DialogDescription>קבוצות עוזרות לסנן מוזמנים ולהושיב אותם יחד.</DialogDescription>
        </DialogHeader>
        {open ? <GroupForm eventId={eventId} group={group} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DeleteGroupButton({ eventId, group }: { eventId: string; group: GroupRow }) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`מחיקת הקבוצה ${group.name}`} disabled={pending}>
          <Trash2Icon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>למחוק את הקבוצה &quot;{group.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            {group.guestCount > 0
              ? `${group.guestCount} הזמנות משויכות לקבוצה. הן לא יימחקו, רק יישארו ללא קבוצה.`
              : "אין מוזמנים בקבוצה הזו."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              start(async () => {
                const r = await deleteGroup(eventId, group.id);
                if (r.ok) toast.success(r.message);
                else toast.error(r.message);
              })
            }
          >
            מחיקה
          </AlertDialogAction>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function GroupsManager({ eventId, groups }: { eventId: string; groups: GroupRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y rounded-xl border">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="size-3 shrink-0 rounded-full" style={{ background: g.color }} aria-hidden="true" />
            <span className="flex-1 font-medium">{g.name}</span>
            <span className="text-sm text-muted-foreground">{g.guestCount} הזמנות</span>
            <GroupDialog eventId={eventId} group={g} />
            <DeleteGroupButton eventId={eventId} group={g} />
          </li>
        ))}
        {groups.length === 0 ? <li className="px-4 py-6 text-center text-sm text-muted-foreground">אין קבוצות</li> : null}
      </ul>
      <div>
        <GroupDialog eventId={eventId} />
      </div>
    </div>
  );
}
