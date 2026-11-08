import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/auth/login'
import Signup from './pages/auth/sign-up'
import ForgotPassword from './pages/auth/forgot-password'
import ResetPassword from './pages/auth/reset-password'
import NotFound from './pages/not-found'
import VerifyEmail from './pages/auth/verify-email'
import Profile from './pages/profile'
import Toaster from './components/toast/toaster'
import { toastRef } from './lib/toast'

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Toaster ref={toastRef} />
    </>
  )
}

export default App