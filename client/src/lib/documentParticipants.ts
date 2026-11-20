export type DocumentParticipant = {
  key: `seller:${number}` | `agent:${number}`;
  name: string;
  role: "Vendeur" | "Agent commercial" | "Caissier";
};

export type CommercialDocumentParticipantRefs = {
  sellerUserId?: number | null;
  salesAgentId?: number | null;
  cashierId?: number | null;
};

export function matchesDocumentParticipant(
  document: CommercialDocumentParticipantRefs,
  filter: string,
) {
  if (filter === "all") return true;
  const [kind, rawId] = filter.split(":");
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return false;
  if (kind === "seller") return document.sellerUserId === id;
  if (kind === "agent") return document.salesAgentId === id || document.cashierId === id;
  return false;
}

export function documentParticipantNames(
  document: CommercialDocumentParticipantRefs,
  participants: DocumentParticipant[],
) {
  const keys = [
    document.sellerUserId ? `seller:${document.sellerUserId}` : null,
    document.salesAgentId ? `agent:${document.salesAgentId}` : null,
    document.cashierId ? `agent:${document.cashierId}` : null,
  ].filter((key): key is DocumentParticipant["key"] => Boolean(key));
  return keys
    .map(key => participants.find(participant => participant.key === key)?.name)
    .filter((name): name is string => Boolean(name))
    .join(" / ") || "—";
}

export function documentParticipantOptionLabel(participant: DocumentParticipant) {
  return `${participant.role} · ${participant.name}`;
}
