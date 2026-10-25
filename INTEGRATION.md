# Réintégration dans MRA-ERP

Document de passage : modifier ici, valider dans l'aperçu Electron, puis
**re-copier dans MRA-ERP** après accord explicite de FATHI. Le dépôt principal
reste intact ; rien n'est poussé sans validation.

## 1. Origine → copie

| MRA-ERP (origine, ne pas bouger) | MRA-Finder (copie modifiable) | Statut |
| --- | --- | --- |
| `src/modules/finder/FinderModule.tsx` | idem | identique (octet à octet) |
| `src/modules/finder/FinderModule.css` | idem | identique |
| `src/contexts/LanguageContext.tsx` | idem | identique |
| `src/locales/fr.json` · `en.json` · `ar.json` | idem | identiques |
| `src/styles/variables.css` · `global.css` | idem | identiques (lecture seule) |
| `src/__tests__/finder-ui.test.tsx` | idem | identique (aucun test modifié) |
| `src/types/global.d.ts` (lignes 290-457, 1077-1085) | `src/types/finder-api.d.ts` | extrait verbatim |
| `electron/services/finder.js` | idem | identique (hash vérifié) |
| `electron/services/finder-import.js` | idem | identique |
| `electron/database/finder-schema.js` | idem | identique |
| `electron/database/finder-catalog-seed.json` | idem | identique |
| `electron/database/better-sqlite3-wrapper.js` | idem | identique |
| `electron/preload.js` (bloc `finder`, lignes 539-551) | `electron/preload.js` | bloc verbatim, seul le périmètre est réduit |
| `electron/main.js` (handlers `finder:*`, lignes 1702-1779) | `electron/main.js` | handlers verbatim + hôte minimal |
| `src/App.tsx` (route `/finder/*`) | absent | jamais modifié |

Conséquence : la copie n'a **plus** de logique métier propre. Chercher une
divergence de comportement se fait maintenant dans `electron/main.js` (hôte) et
`src/DemoApp.tsx` (bandeau), jamais dans le moteur.

## 2. Fichiers à ne JAMAIS réintégrer

Ici uniquement : `src/main.tsx`, `src/DemoApp.tsx`, `electron/main.js`,
`scripts/dev.mjs`, `vite.config.ts`, `jest.config.js`, `index.html`,
`package.json`, `tsconfig.json`, `README.md`, `INTEGRATION.md`, `.gitignore`,
`setupTests.ts` (existe déjà côté MRA-ERP).

Ce sont des fichiers d'hôte : leur remplacement dans MRA-ERP casserait le
montage Electron (où `window.api.finder` vient du `preload.js` complet et où la
base vient de `electron/database/index.js`).

## 3. Modifications autorisées

- `src/modules/finder/FinderModule.tsx` et `.css` : c'est le périmètre du
  développement. Toute nouvelle dépendance d'import doit rester dans le trio
  autorisé (React, `useTranslation`, le CSS du module) — sinon la copie ne sert
  plus à prouver que l'extraction reste fidèle.
- `src/__tests__/finder-ui.test.tsx` : uniquement si le comportement visé change,
  et à valider en même temps que le code (un test modifié pour passer sans
  comportement réel n'est pas un test).
- Clés de traduction : **ajouter dans les trois** `fr/en/ar` avec parité stricte
  (le test i18n de MRA-ERP le vérifie).
- `electron/services/*` et `electron/database/*` : **copiés, donc à resynchroniser
  à l'identique** — toute modification locale doit être reportée dans MRA-ERP
  (ou abandonnée) pour que la copie reste une extraction et non une fourche.

## 4. Dépendances à reconnecter

| Ici | Dans MRA-ERP |
| --- | --- |
| `import { useTranslation } from '../../contexts/LanguageContext'` | même chemin, contexte monté par `src/main.tsx` |
| `window.api.finder` installé par `electron/preload.js` (copie) | idem côté MRA-ERP (bloc complet, 307 canaux) |
| handlers `finder:*` enregistrés par `electron/main.js` (copie) | `MRA-ERP/electron/main.js:1702-1779` |
| base `data/finder-dev.db` (créée par `ensureFinderCatalog`) | `%APPDATA%\mra-erp\mra-erp.db` via `electron/database/index.js` |
| variables CSS `--bg-primary`, `--cyan`, `--font-mono`, `--text-dim`, `--text-main` | `src/styles/variables.css` (déjà importé) |
| `FinderApi` (dans `finder-api.d.ts`) | contrat exact dans `global.d.ts` — les deux doivent bouger ensemble |
| route | `src/App.tsx` : lazy `/finder/*` (lignes 21 et 376) |

## 5. Risques de conflit

1. **`global.d.ts`** : les types `Finder*` y vivent. Si MRA-ERP les change pendant
   que la copie évolue, l'extrait `finder-api.d.ts` devient périmé → resynchroniser
   à la main (extrait délibéré : lignes 290-457 et 1077-1085).
2. **`src/locales/*.json`** : fichiers globaux, modifiés partout dans le projet.
   Une fusion naive peut écraser d'autres ajouts de traduction.
3. **`FinderModule.css`** : classes préfixées `finder-*`, risque de collision
   faible ; l'ordre d'importation du CSS peut changer le rendu des variables.
4. **Comportement `kind: 'ic'`** : le module n'envoie jamais `kind: 'ic'`
   (`FinderModule.tsx:328`). Corriger ici **modifie un comportement visible** de
   MRA-ERP : à faire, si désiré, en SQL/IPC restant inchangés, avec test dédié, et
   **après GO de FATHI** (demande en attente).
5. **Audit d'import** : la copie écrit `data/finder-audit.jsonl` là où MRA-ERP
   écrit dans `activity_log`. Si l'import est modifié ici, vérifier le retour.
6. **Écarts de dépendances** : la copie n'a ni React Router ni le reste de
   `preload.js` ; tout nouveau import hors du trio autorisé signale une dérive
   d'extraction.

## 6. Procédure de réintégration (après accord)

1. Dans la copie : `npm run lint`, `npm test`, `npm run build` — tout au vert,
   puis vérification réelle dans l'aperçu Electron.
2. Dans MRA-ERP : `git status` noté, **aucun `git add .`**, aucune poussée.
3. Comparer fichier par fichier :
   `git diff --no-index src/modules/finder/FinderModule.tsx
   C:/Users/HP/Desktop/MRA-Finder/src/modules/finder/FinderModule.tsx`
   (idem pour le CSS, les locales si touchées, le test si touché).
4. Recopier **uniquement** les fichiers de la section 1 dont le contenu diffère.
5. Rejouer côté MRA-ERP :
   - `npm run lint`
   - `npx jest src/__tests__/finder-ui.test.tsx src/__tests__/i18n.test.ts` (i18n
     16 contrôles, parité des trois langues)
   - `npm run test:ui` (boutons vides)
   - `npm test` complet avant commit
   - `npm run build`
   - ouverture manuelle de la route `/finder` dans l'application
6. Ne committer que les fichiers voulus, message explicite ; **pas de push sans
   instruction**.
