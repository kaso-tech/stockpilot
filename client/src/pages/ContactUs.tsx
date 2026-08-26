import LegalPage from "./LegalPage";

export default function ContactUs() {
  return <LegalPage title="Contactez-nous" updatedAt="26 août 2026" sections={[
    { title: "Assistance fonctionnelle", content: "Pour une question sur les ventes, le stock, un transfert ou une alerte, contactez d’abord l’administrateur de votre entreprise. Il dispose des accès nécessaires pour vérifier les paramètres, l’entrepôt actif et les journaux d’audit." },
    { title: "Préparer votre demande", content: "Indiquez le nom de votre entreprise, votre rôle, l’entrepôt concerné, la date et l’heure approximatives du problème, ainsi que la référence du document ou une capture du message rencontré. Ne transmettez jamais de mot de passe ni de clé d’accès." },
    { title: "Demandes de sécurité", content: "En cas de compte compromis ou d’accès suspect, déconnectez les sessions concernées depuis les réglages de sécurité et prévenez immédiatement l’administrateur de l’entreprise. Conservez les informations de contexte nécessaires à l’analyse sans partager de données confidentielles inutilement." },
  ]} />;
}
