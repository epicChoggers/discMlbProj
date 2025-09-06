export const validateMessage = (text: string): { isValid: boolean; error?: string } => {
  const trimmed = text.trim()
  
  if (!trimmed) {
    return { isValid: false, error: 'Message cannot be empty' }
  }
  
  if (trimmed.length > 500) {
    return { isValid: false, error: 'Message must be 500 characters or less' }
  }
  
  return { isValid: true }
}

export const sanitizeText = (text: string): string => {
  return text.trim().slice(0, 500)
}

export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  if (!password) {
    return { isValid: false, error: 'Password is required' }
  }
  
  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters' }
  }
  
  return { isValid: true }
}
