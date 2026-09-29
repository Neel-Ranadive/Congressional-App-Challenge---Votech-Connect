export type UserRole = 'student' | 'resident' | 'teacher'

export type ProjectStatus = 'pending' | 'approved' | 'in_progress' | 'completed'

export type HourStatus = 'pending' | 'approved'

export function isUserRole(value: unknown): value is UserRole {
  return value === 'student' || value === 'resident' || value === 'teacher'
}

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  trade_area: string | null
}

export interface Project {
  id: string
  resident_id: string
  assigned_student_id: string | null
  title: string
  description: string
  trade_category: string
  location: string
  status: ProjectStatus
  created_at: string
}

export interface FieldHour {
  id: string
  student_id: string
  project_id: string
  hours_logged: number
  status: HourStatus
  teacher_id: string | null
  created_at: string
}
