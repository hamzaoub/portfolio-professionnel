# Démonstration — Portfolio professionnel et génération de CV

**Durée visée : 12 minutes**
**Préparation :** lancer `docker compose up --build`, vérifier `/api/health`, ouvrir le portfolio de démonstration et se connecter à un compte étudiant préparé pour la présentation. Le profil `demo@example.com` est un exemple public sans mot de passe de connexion.

## Déroulement

| Temps       | Démonstration                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–1:00   | Présenter le besoin : publier un portfolio et générer un CV depuis les mêmes données. Nommer React/Vite/TypeScript, Express, PostgreSQL, Redis et Docker Compose.                                 |
| 1:00–2:00   | Montrer l'application et son architecture : navigateur sur `:5173`, API sur `:3000`, PostgreSQL pour les données durables, Redis pour sessions et cache.                                          |
| 2:00–3:30   | Ouvrir `/p/hamza-oubahim`, parcourir les expériences, projets, compétences et formations. Réduire le viewport pour montrer l'adaptation mobile.                                                   |
| 3:30–5:30   | Se connecter au compte étudiant de démonstration. Modifier un champ de profil, ouvrir un élément de contenu, puis montrer l'ajout, l'édition, la suppression ou le réordonnancement d'un élément. |
| 5:30–6:30   | Montrer les réglages de visibilité du portfolio et l'autorisation distincte de téléchargement public du CV. Expliquer qu'un portfolio privé reste accessible à son propriétaire.                  |
| 6:30–9:30   | Ouvrir le générateur de CV. Passer entre Modern et Classic, retirer une section et un élément, afficher l'aperçu, puis télécharger le PDF et montrer son nom et ses pages.                        |
| 9:30–10:30  | Montrer le contrôle de santé et l'API publique. Faire deux requêtes au même slug pour montrer la réponse mise en cache; expliquer l'invalidation après une modification.                          |
| 10:30–11:15 | Résumer la sécurité : mots de passe bcrypt, sessions Redis, limitations de débit, validation Zod, requêtes SQL paramétrées, Helmet et CORS configuré.                                             |
| 11:15–12:00 | Présenter les vérifications : une intégration backend, six tests frontend, builds TypeScript, ESLint et Prettier. Terminer avec les fonctionnalités optionnelles qui ne sont pas incluses.        |

## Parcours de secours

- Si une session de démonstration n'est pas disponible, montrer le portfolio public et le CV PDF déjà généré; ne pas tenter une connexion avec `demo@example.com`.
- Si Redis est indisponible, vérifier `/api/health` et nommer l'état comme une panne de service; ne pas présenter le cache ou les sessions comme fonctionnels.
- Si le téléchargement du navigateur échoue, ouvrir `GET /api/cv/preview?slug=hamza-oubahim&template=modern` et présenter le PDF enregistré dans `output/pdf/`.

## Questions à préparer

- Pourquoi PDFKit? Les modèles sont textuels, partagent un même modèle de données et n'exigent pas un navigateur sans interface.
- Comment le cache reste-t-il cohérent? Les mises à jour invalident la réponse publique du slug concerné. La clé du CV inclut un hash du contenu.
- Qu'est-ce qui reste optionnel? Téléversement d'images, certifications, statistiques, formulaire de contact, thème sombre, interface bilingue, déploiement et export DOCX/JSON Resume.
