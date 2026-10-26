import React from 'react'
import ReactDOM from 'react-dom/client'
import DemoApp from './DemoApp'

import '@fontsource/orbitron/400.css'
import '@fontsource/orbitron/600.css'
import '@fontsource/orbitron/700.css'
import '@fontsource/orbitron/800.css'
import '@fontsource/orbitron/900.css'
import '@fontsource/audiowide/400.css'
import '@fontsource/russo-one/400.css'
import '@fontsource/black-ops-one/400.css'
import '@fontsource/rajdhani/400.css'
import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'

import './styles/variables.css'
import './styles/global.css'
import './styles/transformers-font.css'

// `window.api.finder` est fourni par electron/preload.js, exactement comme dans
// MRA-ERP. Aucun pont simulé n'est installé ici : lancé hors Electron, le module
// affiche son message d'indisponibilité — c'est son comportement réel.
const root = document.getElementById('root')
if (!root) throw new Error('racine #root absente de index.html')

ReactDOM.createRoot(root).render(<DemoApp />)
