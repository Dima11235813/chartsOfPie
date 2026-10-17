import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LearnPage } from './LearnPage'
import '../styles.css'
import './learn.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LearnPage />
  </StrictMode>,
)
