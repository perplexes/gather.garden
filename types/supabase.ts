export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null
          email: string
          id: number
          phone: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: number
          phone: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: number
          phone?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          created_at: string | null
          id: number
          llm_summary: string | null
          phone: string | null
          sent_to_email_at: string | null
          transcription: string | null
          twilio_media_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          llm_summary?: string | null
          phone?: string | null
          sent_to_email_at?: string | null
          transcription?: string | null
          twilio_media_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          llm_summary?: string | null
          phone?: string | null
          sent_to_email_at?: string | null
          transcription?: string | null
          twilio_media_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}