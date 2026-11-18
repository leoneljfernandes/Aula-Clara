import type { ReactNode } from "react";

import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import type { VoiceConsentKind } from "@/lib/voice/consent";

interface VoiceConsentDialogProps {
  kind: VoiceConsentKind;
  onAccept: () => void;
  onCancel: () => void;
}

/** Pide permiso antes de la primera vez que el navegador manda la voz a su servicio de reconocimiento. */
export function VoiceConsentDialog({ kind, onAccept, onCancel }: VoiceConsentDialogProps): ReactNode {
  return (
    <Dialog title="Antes de usar el micrófono" onClose={onCancel} labelId="voice-consent-title">
      <div className="space-y-3 text-lg">
        <p>
          Para entender tu voz, el navegador envía el audio a su servicio de reconocimiento (Google en Chrome,
          Microsoft en Edge, Apple en Safari), salvo que pueda procesarlo en tu dispositivo. Aula Clara no
          graba ni guarda el audio.
        </p>
        {kind === "captions" && (
          <p>
            Vas a transcribir lo que dicen otras personas. Pedile permiso al docente y avisá a tus compañeros.
            La transcripción no se guarda: se borra al salir del lector.
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button onClick={onCancel}>Ahora no</Button>
        <Button variant="primary" onClick={onAccept}>
          Usar el micrófono
        </Button>
      </div>
    </Dialog>
  );
}
