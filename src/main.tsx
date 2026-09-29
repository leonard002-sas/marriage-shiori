import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppFamilyV2'
import './styles.css'
import './family.css'
import './book-catalog.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
