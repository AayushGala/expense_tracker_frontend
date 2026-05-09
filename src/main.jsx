import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Stop mouse-wheel from changing focused number inputs (e.g. amount fields).
// The browser increments/decrements a focused <input type="number"> on wheel by default,
// which silently corrupts entered amounts when the user scrolls the page.
document.addEventListener('wheel', () => {
  const el = document.activeElement
  if (el && el.tagName === 'INPUT' && el.type === 'number') {
    el.blur()
  }
}, { passive: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
