# MRA FINDER — copie fidèle (développement isolé)

Copie **indépendante** du module Finder de MRA-ERP (dépôt privé, non publié),
qui conserve le code, l'interface et la **logique métier d'origine** : même
`FinderModule.tsx`, même moteur `electron/services/finder.js`, même schéma
SQLite, même preload, mêmes handlers IPC. Le dépôt MRA-ERP reste intact : rien
ici ne le modifie, rien ici ne l'expose.

> **Périmètre de cette publication.** Ce dépôt ne contient que la copie du module
> Finder : aucun secret, aucune clé, aucun `.env`, aucune base de données, aucune
> donnée client ou commerciale. Le dépôt d'origine MRA-ERP reste privé et n'est
> jamais modifié depuis ici. Toute modification est proposée, puis réintégrée
> dans MRA-ERP après validation explicite.

## Démarrer l'aperçu

```bash
npm install     # une seule fois
npm start       # Vite (renderer) + Electron (moteur Finder)
```

- renderer : **http://localhost:5175** (port fixe, jamais celui de MRA-ERP) ;
- fenêtre Electron : c'est là que `window.api.finder` existe, fourni par
  `electron/preload.js` comme dans MRA-ERP ;
- HMR : toute modification sous `src/` est visible sans redémarrage.

Sans Electron (`npm run dev` puis ouverture du navigateur), le module affiche
« Le module de recherche n'est pas disponible sur ce poste. » : comportement
réel, aucun pont de secours n'est simulé.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm start` | aperçu complet : Vite + Electron (`scripts/dev.mjs`) |
| `npm run dev` | serveur Vite seul (renderer sans pont IPC) |
| `npm run app` | Electron seul (suppose Vite déjà lancé) |
| `npm run build` | build de production dans `dist/` |
| `npm run preview` | sert le build sur le port 5175 |
| `npm run lint` | `tsc --noEmit` (typage strict) |
| `npm test` | suite Jest (jsdom) |

## Périmètre — ce qui vient de MRA-ERP

### Renderer (inchangé, octet à octet)

| Fichier | Origine |
| --- | --- |
| `src/modules/finder/FinderModule.tsx` | `MRA-ERP/src/modules/finder/` |
| `src/modules/finder/FinderModule.css` | idem |
| `src/contexts/LanguageContext.tsx` | `MRA-ERP/src/contexts/` |
| `src/locales/{fr,en,ar}.json` | `MRA-ERP/src/locales/` (clés entières) |
| `src/styles/{variables,global}.css` | `MRA-ERP/src/styles/` |
| `src/__tests__/finder-ui.test.tsx` | `MRA-ERP/src/__tests__/` (inchangé) |
| `src/setupTests.ts`, `src/__mocks__/styleMock.js` | idem |
| `src/types/finder-api.d.ts` | extrait verbatim de `MRA-ERP/src/types/global.d.ts` (lignes 290-457 + contrat `window.api.finder`) |

### Moteur et données (copiés à l'identique, hash vérifié)

| Fichier | Origine |
| --- | --- |
| `electron/services/finder.js` | `MRA-ERP/electron/services/finder.js` — recherche, fiches, compteurs |
| `electron/services/finder-import.js` | idem — import CSV/JSON (seul canal qui écrit) |
| `electron/database/finder-schema.js` | idem — 17 tables `finder_*`, taxonomie, seed, index de recherche |
| `electron/database/finder-catalog-seed.json` | idem — catalogue de départ du dépôt (306 modèles) |
| `electron/database/better-sqlite3-wrapper.js` | idem — pilote sql.js (WASM, sans compilation native) |
| `electron/preload.js` | **bloc `finder` verbatim** de `MRA-ERP/electron/preload.js:539-551` |
| `electron/main.js` | **9 handlers `finder:*` verbatim** de `MRA-ERP/electron/main.js:1702-1779` (+ helper `safeError` ligne 853) |

`electron/main.js` ajoute uniquement de l'hôte : ouverture de la base locale,
fenêtre, chargement du renderer. Il ne contient aucune logique métier.

### Propres à cette copie (à ne jamais réintégrer)

- `src/main.tsx`, `src/DemoApp.tsx` : montage + bandeau de provenance ;
- `electron/main.js` (hôte), `scripts/dev.mjs` (lanceur) ;
- `vite.config.ts`, `jest.config.js`, `index.html`, `package.json`, `tsconfig.json`.

## Données affichées

Base de développement **distincte** : `data/finder-dev.db`, créée au premier
lancement par `ensureFinderCatalog()` à partir du seed du dépôt.

- **catalogue de départ** : `finder-catalog-seed.json` — 306 modèles, 7 marques
  (données publiques du dépôt MRA-ERP) ;
- **pièces, IC, compatibilités** : **0** tant que rien n'a été importé. Le module
  affiche 0, jamais une valeur simulée — l'ancien jeu de données fictives a été
  supprimé (`src/data/finder-demo.json`, `src/mock/finderBridge.ts`) ;
- **la base de production MRA-ERP (`%APPDATA%\mra-erp\mra-erp.db`) n'est jamais
  ouverte, ni lue, ni référencée** ;
- `data/` est ignoré par git : aucune base n'est versionnée.

Le bandeau en haut de page rappelle cette provenance en permanence.

## Ce qui fonctionne réellement

- tableau de bord : compteurs calculés par le moteur original sur la base locale ;
- recherche par jetons / préfixe, modes Pièces et Appareils (`GROUP BY kind, ref_id`) ;
- fiches appareil, fiche marque (+ ses appareils), fiche pièce, fiche IC ;
- import CSV/JSON via `finder-import.js` : rapport réel (inserted/updated/skipped/
  rejected), enregistré dans la base locale ;
- trilinguisme FR/EN/AR ;
- mode Photo : annoncé indisponible par le module lui-même, aucun résultat simulé.

## Limites assumées

- **Catalogue de départ volontairement maigre** : 306 modèles, 0 pièce, 0 IC.
  Pour obtenir le catalogue complet (4 555 appareils), il faut rejouer
  l'importateur de sources publiques de MRA-ERP
  (`scripts/finder/import-catalog.mjs`) contre cette base — hors périmètre pour
  l'instant, et jamais contre la base de production.
- **Audit d'import** : MRA-ERP écrit dans la table `activity_log` ; la copie n'a
  pas cette table, l'écriture part dans `data/finder-audit.jsonl`. C'est la seule
  divergence de comportement de l'hôte.
- **Recherche des IC** : `FinderModule.tsx` (ligne 328) n'envoie que
  `kind: 'part' | 'device'` — comportement **identique** à MRA-ERP aujourd'hui,
  non corrigé ici ; voir `INTEGRATION.md`.
- **Logos et photos absents** : le module affiche le champ comme manquant, il ne
  remplace pas par une image.
- **Marques sans modèle** : compteur à 0 plutôt que masquées (comme l'original).

## Sécurité

Aucun `.env`, aucune clé, aucune licence, aucune donnée client ou commerciale.
Le `.gitignore` exclut `node_modules/`, `dist/`, `data/`, les `.env`. Les
traductions sont celles de MRA-ERP (contenu applicatif, aucun secret).

## Tests

```bash
npm run lint     # tsc --noEmit
npm test         # src/__tests__/finder-ui.test.tsx — 17 contrôles
```

Le test est la copie **inchangée** de celui de MRA-ERP : il injecte une fausse
`window.api.finder` (frontière IPC) et vérifie que le composant ne fabrique
jamais ses propres chiffres. Aucun test n'a été supprimé ni modifié.
