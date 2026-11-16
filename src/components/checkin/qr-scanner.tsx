"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CameraState = "starting" | "scanning" | "denied" | "unavailable";

const CAMERA_MESSAGES: Record<Exclude<CameraState, "starting" | "scanning">, string> = {
  denied: "אין הרשאה למצלמה. אפשרו גישה למצלמה בהגדרות הדפדפן, או הזינו את הקוד ידנית.",
  unavailable: "לא נמצאה מצלמה זמינה במכשיר. אפשר להזין את הקוד או הקישור ידנית.",
};

/**
 * Reads QR codes from the camera (jsQR on downscaled frames, so it works in
 * every browser, iOS Safari included) and offers manual entry as a fallback.
 * Calls onCode once per distinct code; the parent decides what it means.
 */
export function QrScanner({ onCode, busy }: { onCode: (text: string) => void; busy: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [manual, setManual] = useState("");
  const onCodeRef = useRef(onCode);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCodeRef.current = onCode;
    busyRef.current = busy;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let last = { text: "", at: 0 };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (e) {
        const name = (e as DOMException)?.name;
        setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setCamera("scanning");

      const { default: jsQR } = await import("jsqr");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      let lastScan = 0;

      const tick = (now: number) => {
        if (stopped) return;
        frame = requestAnimationFrame(tick);
        if (now - lastScan < 120 || video.readyState < 2 || busyRef.current) return;
        lastScan = now;
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        if (!w || !h) return;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" });
        if (!code?.data) return;
        // the same code stays in view: report it again only after a pause
        if (code.data === last.text && now - last.at < 3000) return;
        last = { text: code.data, at: now };
        onCodeRef.current(code.data);
      };
      frame = requestAnimationFrame(tick);
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black sm:aspect-video">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="תצוגת המצלמה"
          className="size-full object-cover"
          data-camera={camera}
        />
        {camera === "scanning" ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
        ) : null}
        {camera === "starting" ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">מפעילים את המצלמה…</p>
        ) : null}
        {camera === "denied" || camera === "unavailable" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <CameraOffIcon className="size-8" aria-hidden="true" />
            <p className="text-sm">{CAMERA_MESSAGES[camera]}</p>
          </div>
        ) : null}
      </div>
      {camera === "scanning" ? (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {busy ? "מחפשים את האורח…" : "כוונו את המצלמה לקוד ה-QR שבהזמנה"}
        </p>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onCode(manual.trim());
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          aria-label="קוד או קישור הזמנה"
          placeholder="הדבקת קישור או קוד הזמנה"
          dir="auto"
          className="flex-1"
          autoComplete="off"
        />
        <Button type="submit" variant="outline" disabled={busy || !manual.trim()}>
          איתור
        </Button>
      </form>
    </div>
  );
}
