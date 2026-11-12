import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fileToBase64 } from "@/lib/emailDocument";
import { documentShareLink, documentShareMessage, type DocumentShareChannel } from "@/lib/documentShare";
import { trpc } from "@/lib/trpc";
import { ChevronDown, Mail, MessageCircle, Send, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DocumentSendMenuProps = {
  documentLabel: string;
  documentNumber: string;
  total: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  documentId?: number;
  documentKind?: "sale" | "purchaseOrder";
  getPdfFile?: () => File;
  onDelivered?: () => void;
};
const MAX_PDF_BYTES = 5 * 1024 * 1024;

export function DocumentSendMenu({ documentLabel, documentNumber, total, customerName, customerPhone, customerEmail, documentId, documentKind, getPdfFile, onDelivered }: DocumentSendMenuProps) {
  const [channel, setChannel] = useState<DocumentShareChannel | null>(null);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const sendSale = trpc.documents.sendSale.useMutation();
  const sendPurchaseOrder = trpc.documents.sendPurchaseOrder.useMutation();
  const sending = sendSale.isPending || sendPurchaseOrder.isPending;
  const start = (next: DocumentShareChannel) => { setChannel(next); setSubject(`${documentLabel} ${documentNumber}`); setMessage(documentShareMessage({ documentLabel, documentNumber, customerName, total })); };
  const fallbackEmail = async (file: File | undefined) => {
    if (!customerEmail) return toast.error("L’adresse e-mail du destinataire est manquante.");
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: subject, text: message, files: [file] }); toast.success("Le document est prêt à être partagé par e-mail."); setChannel(null); return; }
      catch { return; }
    }
    if (file) {
      const url = URL.createObjectURL(file);
      const link = document.createElement("a"); link.href = url; link.download = file.name; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const body = file ? `${message}\n\nLe PDF a été téléchargé : joignez-le à ce message.` : message;
    const link = documentShareLink("email", { email: customerEmail, subject, message: body });
    if (!link) return toast.error("Impossible de préparer l’e-mail.");
    window.location.href = link;
    toast.info(file ? "Le PDF est téléchargé. Joignez-le au message e-mail qui s’ouvre." : "Votre application e-mail va s’ouvrir.");
    setChannel(null);
  };
  const send = async () => {
    if (!channel) return;
    if (channel === "email") {
      if (!customerEmail) return toast.error("L’adresse e-mail du destinataire est manquante.");
      const file = getPdfFile?.();
      if (!navigator.onLine || !file || !documentId || !documentKind) { await fallbackEmail(file); return; }
      if (file.size > MAX_PDF_BYTES) return toast.error("Le PDF dépasse la limite de 5 Mo.");
      try {
        const payload = { id: documentId, pdfBase64: await fileToBase64(file), filename: file.name, subject, message };
        const result = documentKind === "sale" ? await sendSale.mutateAsync(payload) : await sendPurchaseOrder.mutateAsync(payload);
        if (result.delivered) { toast.success(`${documentLabel} envoyé par e-mail à ${customerEmail}.`); onDelivered?.(); setChannel(null); return; }
        await fallbackEmail(file);
      } catch (error) {
        if (!navigator.onLine) { await fallbackEmail(file); return; }
        toast.error(error instanceof Error ? error.message : "Envoi impossible. Réessayez ou utilisez le partage local.");
      }
      return;
    }
    const link = documentShareLink(channel, { phone: customerPhone, email: customerEmail, subject, message });
    if (!link) return toast.error("Le numéro de téléphone du destinataire est manquant.");
    if (channel === "whatsapp") window.open(link, "_blank", "noopener,noreferrer"); else window.location.href = link;
    setChannel(null);
  };
  return <><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Send className="mr-2 h-4 w-4" />Envoyer<ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => start("whatsapp")}><MessageCircle className="mr-2 h-4 w-4 text-emerald-500" />WhatsApp</DropdownMenuItem><DropdownMenuItem onSelect={() => start("sms")}><Smartphone className="mr-2 h-4 w-4 text-sky-500" />SMS</DropdownMenuItem><DropdownMenuItem onSelect={() => start("email")}><Mail className="mr-2 h-4 w-4 text-primary" />E-mail + PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Dialog open={Boolean(channel)} onOpenChange={open => !open && !sending && setChannel(null)}><DialogContent><DialogHeader><DialogTitle>Prévisualiser l’envoi</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{channel === "email" ? customerEmail || "E-mail non renseigné" : customerPhone || "Téléphone non renseigné"}</div>{channel === "email" && <div className="space-y-2"><Label htmlFor="document-email-subject">Objet</Label><Input id="document-email-subject" value={subject} maxLength={200} onChange={event => setSubject(event.target.value)} /></div>}<div className="space-y-2"><Label htmlFor="document-send-message">Message</Label><Textarea id="document-send-message" rows={7} maxLength={5000} value={message} onChange={event => setMessage(event.target.value)} /></div></div><DialogFooter><Button variant="outline" disabled={sending} onClick={() => setChannel(null)}>Annuler</Button><Button disabled={sending} onClick={send}><Send className="mr-2 h-4 w-4" />{sending ? "Envoi…" : channel === "whatsapp" ? "Ouvrir WhatsApp" : channel === "sms" ? "Ouvrir SMS" : "Envoyer par e-mail"}</Button></DialogFooter></DialogContent></Dialog></>;
}
