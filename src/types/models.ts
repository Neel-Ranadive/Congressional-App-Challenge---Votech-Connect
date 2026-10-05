export type UserRole = 'student' | 'resident' | 'teacher' | 'industry_partner' | 'admin'

export type ProjectStatus = 'pending' | 'approved' | 'in_progress' | 'completed'

export type HourStatus = 'pending' | 'approved'
export type OpportunityStatus = 'pending' | 'approved' | 'rejected' | 'closed'
export type PlacementInterestStatus = 'pending' | 'approved' | 'rejected'

export function isUserRole(value: unknown): value is UserRole {
  return value === 'student' ||
    value === 'resident' ||
    value === 'teacher' ||
    value === 'industry_partner' ||
    value === 'admin'
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

export interface PartnerOpportunity {
  id: string
  partner_id: string
  organization_name: string
  title: string
  trade_category: string
  description: string
  learning_goals: string
  supervision_plan: string
  location: string
  compensation_status: 'paid' | 'unpaid_educational' | 'to_be_determined'
  status: OpportunityStatus
  created_at: string
}

export interface PlacementInterest {
  id: string
  opportunity_id: string
  student_id: string
  status: PlacementInterestStatus
  teacher_id: string | null
  created_at: string
}
