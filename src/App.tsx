import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })))
const KeywordRanking = lazy(() => import('./pages/KeywordRanking').then((m) => ({ default: m.KeywordRanking })))
const DataManagement = lazy(() => import('./pages/DataManagement').then((m) => ({ default: m.DataManagement })))
const ProductRanking = lazy(() => import('./pages/ProductRanking').then((m) => ({ default: m.ProductRanking })))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<ProductRanking />} />
            <Route path="/keywords" element={<KeywordRanking />} />
            <Route path="/data" element={<DataManagement />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}
