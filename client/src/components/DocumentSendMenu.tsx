import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { documentEmailMessage, documentShareMessage, documentShareSubject, emailShareUrl, normalizedPhone, smsShareUrl, type CommercialDocumentType, whatsappShareUrl } from "@/lib/documentShare";
import { Download, Mail, MessageCircle, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";

type DocumentSendMenuProps = {
  type: CommercialDocumentType;
  documentNumber: string;
  total: string;
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  downloadPdf?: () => void;
};

export function DocumentSendMenu({ type, documentNumber, total, customer, downloadPdf }: DocumentSendMenuProps) {
  const input = { type, documentNumber, total, customerName: customer?.name };
  const message = documentShareMessage(input);
  const subject = documentShareSubject(input);
  const phone = normalizedPhone(customer?.phone);
  const email = customer?.email?.trim() ?? "";

  const sendEmail = () => {
    if (!email) return toast.error("L’adresse e-mail du client n’est pas renseignée.");
    downloadPdf?.();
    window.location.href = emailShareUrl(email, subject, documentEmailMessage(input));
    toast.info("Le PDF a été téléchargé. Joignez-le à l’e-mail prérempli qui s’ouvre.");
  };

  const sendWhatsapp = () => {
    if (!phone) return toast.error("Le numéro WhatsApp du client n’est pas renseigné.");
    window.open(whatsappShareUrl(phone, message), "_blank", "noopener,noreferrer");
  };

  const sendSms = () => {
    if (!phone) return toast.error("Le numéro de téléphone du client n’est pas renseigné.");
    window.location.href = smsShareUrl(phone, message);
  };

  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Send className="mr-2 h-4 w-4" />Envoyer</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel>{customer?.name || "Client du document"}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={sendWhatsapp}><MessageCircle className="mr-2 h-4 w-4 text-emerald-600" />WhatsApp</DropdownMenuItem><DropdownMenuItem onSelect={sendSms}><Smartphone className="mr-2 h-4 w-4 text-primary" />SMS</DropdownMenuItem><DropdownMenuItem onSelect={sendEmail}><Mail className="mr-2 h-4 w-4 text-sky-600" />E-mail + PDF</DropdownMenuItem>{downloadPdf && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={downloadPdf}><Download className="mr-2 h-4 w-4" />Télécharger le PDF</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>;
}
