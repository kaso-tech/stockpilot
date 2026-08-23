# Audit thème clair

- La carte d’inscription blanche reste lisible, mais les textes secondaires, les liens cyan et les contours de champs sont trop peu contrastés sur fond clair.
- Les styles à base de `text-slate-400`, `text-cyan-*` et `border-white/*` doivent recevoir des remplacements spécifiques au thème clair.
- Les contrôles de formulaire, libellés et liens doivent conserver un contraste prononcé avec la couleur principale `#007B8B`.
- Le domaine publié affiche encore le style antérieur tant que cette correction de thème n’est pas publiée ; la version de développement charge correctement l’écran d’inscription et servira à la vérification avant publication.
- La préférence de thème de la prévisualisation utilise la clé locale `theme`; le contrôle visuel final forcera explicitement cette valeur à `light`.
- Contrôle final : les titres, libellés, champs, bordures, liens et commandes du formulaire d’inscription restent visuellement distinguables sur la carte blanche et le fond bleu pâle.
- Le thème sombre a été rétabli et conserve ses surfaces foncées, ses textes clairs et ses contrôles lisibles après les ajustements propres au thème clair.
