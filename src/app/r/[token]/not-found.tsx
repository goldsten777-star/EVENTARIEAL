export default function RsvpNotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">הקישור אינו תקף</h1>
      <p className="max-w-sm text-muted-foreground">
        ייתכן שהקישור הועתק באופן חלקי או שהוחלף. בקשו מהמארחים לשלוח אותו שוב.
      </p>
    </main>
  );
}
