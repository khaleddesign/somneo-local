export const STUDY_STATUS = {
  PENDING: 'en_attente',
  IN_PROGRESS: 'en_cours',
  COMPLETED: 'termine'
} as const

export const USER_ROLES = {
  CLIENT: 'client',
  AGENT: 'agent',
  ADMIN: 'admin'
} as const

export const STORAGE_BUCKETS = {
  STUDIES: 'study-files', // Note: Using 'study-files' instead of 'studies-files' to match the actual bucket used in prod.
  REPORTS: 'reports-files'
} as const

export const MAX_FILE_SIZE = {
  EDF: 2 * 1024 * 1024 * 1024, // 2GB
  PDF: 50 * 1024 * 1024 // 50MB
} as const

export type StudyStatus = typeof STUDY_STATUS[keyof typeof STUDY_STATUS]
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]
