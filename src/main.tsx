import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppFamily'
import './styles.css'
import './family.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
