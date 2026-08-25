import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { documentShareMessage, documentShareSubject, emailShareUrl, normalizedPhone, smsShareUrl, type CommercialDocumentType, whatsappShareUrl } from "@/lib/documentShare";
import { Download, Mail, MessageCircle, Send, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Channel = "whatsapp" | "sms" | "email";

type DocumentSendMenuProps = {
  type: CommercialDocumentType;
  documentNumber: string;
  total: string;
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  downloadPdf?: () => void;
};

const channelMeta: Record<Channel, { label: string; button: string }> = {
  whatsapp: { label: "WhatsApp", button: "Ouvrir WhatsApp" },
  sms: { label: "SMS", button: "Ouvrir les SMS" },
  email: { label: "E-mail", button: "Ouvrir l’e-mail" },
};

export function DocumentSendMenu({ type, documentNumber, total, customer, downloadPdf }: DocumentSendMenuProps) {
  const input = { type, documentNumber, total, customerName: customer?.name };
  const phone = normalizedPhone(customer?.phone);
  const email = customer?.email?.trim() ?? "";
  const [channel, setChannel] = useState<Channel | null>(null);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");

  const openPreview = (nextChannel: Channel) => {
    if ((nextChannel === "whatsapp" || nextChannel === "sms") && !phone) return toast.error("Le numéro de téléphone du client n’est pas renseigné.");
    if (nextChannel === "email" && !email) return toast.error("L’adresse e-mail du client n’est pas renseignée.");
    setMessage(documentShareMessage(input));
    setSubject(documentShareSubject(input));
    setChannel(nextChannel);
  };

  const confirmSend = () => {
    if (!channel) return;
    if (channel === "whatsapp") window.open(whatsappShareUrl(phone, message), "_blank", "noopener,noreferrer");
    if (channel === "sms") window.location.href = smsShareUrl(phone, message);
    if (channel === "email") {
      downloadPdf?.();
      window.location.href = emailShareUrl(email, subject, `${message}\n\nLe PDF du document a été téléchargé : joignez-le à ce message.`);
      toast.info("Le PDF a été téléchargé. Joignez-le à l’e-mail prérempli qui s’ouvre.");
    }
    setChannel(null);
  };

  const recipient = channel === "email" ? email : customer?.phone || "";
  return <><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Send className="mr-2 h-4 w-4" />Envoyer</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel>{customer?.name || "Client du document"}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => openPreview("whatsapp")}><MessageCircle className="mr-2 h-4 w-4 text-emerald-600" />WhatsApp</DropdownMenuItem><DropdownMenuItem onSelect={() => openPreview("sms")}><Smartphone className="mr-2 h-4 w-4 text-primary" />SMS</DropdownMenuItem><DropdownMenuItem onSelect={() => openPreview("email")}><Mail className="mr-2 h-4 w-4 text-sky-600" />E-mail + PDF</DropdownMenuItem>{downloadPdf && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={downloadPdf}><Download className="mr-2 h-4 w-4" />Télécharger le PDF</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu><Dialog open={Boolean(channel)} onOpenChange={open => !open && setChannel(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Prévisualiser l’envoi</DialogTitle><DialogDescription>Vérifiez et ajustez le contenu avant d’ouvrir {channel ? channelMeta[channel].label : "le canal"}.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Destinataire</Label><Input value={recipient} readOnly /></div>{channel === "email" && <div className="space-y-2"><Label htmlFor="document-send-subject">Objet</Label><Input id="document-send-subject" value={subject} onChange={event => setSubject(event.target.value)} /></div>}<div className="space-y-2"><Label htmlFor="document-send-message">Message</Label><Textarea id="document-send-message" value={message} onChange={event => setMessage(event.target.value)} rows={8} /></div>{channel === "email" && <p className="text-xs text-muted-foreground">Le PDF sera téléchargé pour être joint au message e-mail.</p>}</div><DialogFooter><Button variant="outline" onClick={() => setChannel(null)}>Annuler</Button><Button onClick={confirmSend} disabled={!message.trim() || (channel === "email" && !subject.trim())}>{channel ? channelMeta[channel].button : "Envoyer"}</Button></DialogFooter></DialogContent></Dialog></>;
}
