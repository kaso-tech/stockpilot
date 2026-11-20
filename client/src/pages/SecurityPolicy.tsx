import LegalPage from "./LegalPage";

export default function SecurityPolicy() {
  return <LegalPage title="Politique de sécurité" updatedAt="26 août 2026" sections={[
    { title: "Accès et authentification", content: "Chaque utilisateur doit utiliser un compte individuel, un mot de passe robuste et ne jamais partager ses identifiants. L’administrateur doit désactiver les comptes qui ne sont plus nécessaires et contrôler régulièrement les sessions actives." },
    { title: "Cloisonnement des données", content: "Les données sont isolées par entreprise. Dans une entreprise, les accès opérationnels peuvent être limités par entrepôt et par rôle : responsable, caissier ou vendeur. Les opérations sensibles sont contrôlées côté serveur et consignées dans le journal d’audit." },
    { title: "Protection opérationnelle", content: "Les transferts de stock, mouvements, seuils de réapprovisionnement et actions d’encaissement suivent des validations métier. Les alertes de rupture sont limitées aux responsables concernés afin de réduire les accès inutiles aux informations opérationnelles." },
    { title: "Bonnes pratiques", content: "Utilisez des appareils protégés, maintenez le navigateur à jour, verrouillez les postes partagés et vérifiez les sauvegardes. Toute suspicion d’accès non autorisé doit conduire à une révocation des sessions et à la modification des mots de passe concernés." },
  ]} />;
}
