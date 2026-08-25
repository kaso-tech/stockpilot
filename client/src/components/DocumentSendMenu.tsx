import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { documentShareLink, documentShareMessage, type DocumentShareChannel } from "@/lib/documentShare";
import { ChevronDown, Mail, MessageCircle, Send, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function DocumentSendMenu({ documentLabel, documentNumber, total, customerName, customerPhone, customerEmail }: { documentLabel: string; documentNumber: string; total: string; customerName?: string | null; customerPhone?: string | null; customerEmail?: string | null }) {
  const [channel, setChannel] = useState<DocumentShareChannel | null>(null);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const start = (next: DocumentShareChannel) => { setChannel(next); setSubject(`${documentLabel} ${documentNumber}`); setMessage(documentShareMessage({ documentLabel, documentNumber, customerName, total })); };
  const send = () => { if (!channel) return; const link = documentShareLink(channel, { phone: customerPhone, email: customerEmail, subject, message }); if (!link) return toast.error(channel === "email" ? "L’adresse e-mail du client est manquante." : "Le numéro de téléphone du client est manquant."); if (channel === "whatsapp") window.open(link, "_blank", "noopener,noreferrer"); else window.location.href = link; setChannel(null); };
  return <><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Send className="mr-2 h-4 w-4" />Envoyer<ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => start("whatsapp")}><MessageCircle className="mr-2 h-4 w-4 text-emerald-500" />WhatsApp</DropdownMenuItem><DropdownMenuItem onSelect={() => start("sms")}><Smartphone className="mr-2 h-4 w-4 text-sky-500" />SMS</DropdownMenuItem><DropdownMenuItem onSelect={() => start("email")}><Mail className="mr-2 h-4 w-4 text-primary" />E-mail</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Dialog open={Boolean(channel)} onOpenChange={open => !open && setChannel(null)}><DialogContent><DialogHeader><DialogTitle>Prévisualiser l’envoi</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{channel === "email" ? customerEmail || "E-mail non renseigné" : customerPhone || "Téléphone non renseigné"}</div>{channel === "email" && <div className="space-y-2"><Label>Objet</Label><Input value={subject} onChange={event => setSubject(event.target.value)} /></div>}<div className="space-y-2"><Label>Message</Label><Textarea rows={7} value={message} onChange={event => setMessage(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setChannel(null)}>Annuler</Button><Button onClick={send}><Send className="mr-2 h-4 w-4" />Ouvrir {channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : "l’e-mail"}</Button></DialogFooter></DialogContent></Dialog></>;
}
