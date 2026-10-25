import React from 'react'
import ReactDOM from 'react-dom/client'
import DemoApp from './DemoApp'

import './styles/variables.css'
import './styles/global.css'

// `window.api.finder` est fourni par electron/preload.js, exactement comme dans
// MRA-ERP. Aucun pont simulé n'est installé ici : lancé hors Electron, le module
// affiche son message d'indisponibilité — c'est son comportement réel.
const root = document.getElementById('root')
if (!root) throw new Error('racine #root absente de index.html')

ReactDOM.createRoot(root).render(<DemoApp />)
