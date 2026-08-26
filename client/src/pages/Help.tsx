import LegalPage from "./LegalPage";

export default function Help() {
  return <LegalPage title="Aide" updatedAt="26 août 2026" sections={[
    { title: "Démarrer avec StockPilot Pro", content: "Commencez par créer vos entrepôts, renseigner vos produits et définir les seuils de réapprovisionnement de chaque dépôt. Attribuez ensuite les rôles locaux aux membres de votre équipe afin que chacun accède uniquement aux opérations nécessaires." },
    { title: "Ventes, stock et transferts", content: "Sélectionnez l’entrepôt actif avant de consulter les stocks ou réaliser une opération. Les ventes, mouvements, inventaires, alertes et tableaux de bord suivent ce dépôt. Pour déplacer des produits, créez un transfert, expédiez-le puis réceptionnez-le dans l’entrepôt destinataire." },
    { title: "Alertes et responsables", content: "Les alertes de stock bas sont calculées par produit et entrepôt. Les responsables d’entrepôt reçoivent les notifications liées à leurs dépôts et peuvent accuser réception d’une alerte afin de confirmer sa prise en charge." },
    { title: "Assistance", content: "Avant de solliciter une assistance, relevez la référence du document, le nom de l’entrepôt concerné et une capture du message affiché. Ces éléments permettent à l’administrateur de votre entreprise ou à l’équipe de support d’identifier plus rapidement le contexte." },
  ]} />;
}
