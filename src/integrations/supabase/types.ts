export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          currency: string
          id: string
          instructions: string | null
          is_active: boolean
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      crypto_prices: {
        Row: {
          change_24h: number
          market_cap: number | null
          name: string
          price_usd: number
          symbol: string
          updated_at: string
        }
        Insert: {
          change_24h?: number
          market_cap?: number | null
          name: string
          price_usd: number
          symbol: string
          updated_at?: string
        }
        Update: {
          change_24h?: number
          market_cap?: number | null
          name?: string
          price_usd?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      deposit_addresses: {
        Row: {
          address: string
          currency: string
          id: string
          instructions: string | null
          is_active: boolean
          min_deposit: number
          network: string
        }
        Insert: {
          address: string
          currency: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          min_deposit?: number
          network: string
        }
        Update: {
          address?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          min_deposit?: number
          network?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number | null
          bank_account_id: string | null
          created_at: string
          currency: string | null
          fx_rate: number | null
          id: string
          method: string
          network: string | null
          ngn_amount: number | null
          platform_fee_usd: number | null
          processed_at: string | null
          proof_url: string | null
          sender_name: string | null
          status: Database["public"]["Enums"]["tx_status"]
          tx_hash: string | null
          usd_value: number | null
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          amount?: number | null
          bank_account_id?: string | null
          created_at?: string
          currency?: string | null
          fx_rate?: number | null
          id?: string
          method?: string
          network?: string | null
          ngn_amount?: number | null
          platform_fee_usd?: number | null
          processed_at?: string | null
          proof_url?: string | null
          sender_name?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tx_hash?: string | null
          usd_value?: number | null
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          amount?: number | null
          bank_account_id?: string | null
          created_at?: string
          currency?: string | null
          fx_rate?: number | null
          id?: string
          method?: string
          network?: string | null
          ngn_amount?: number | null
          platform_fee_usd?: number | null
          processed_at?: string | null
          proof_url?: string | null
          sender_name?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tx_hash?: string | null
          usd_value?: number | null
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposits_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          currency: string
          rate_per_usd: number
          source: string | null
          updated_at: string
        }
        Insert: {
          currency: string
          rate_per_usd: number
          source?: string | null
          updated_at?: string
        }
        Update: {
          currency?: string
          rate_per_usd?: number
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          address_url: string | null
          admin_notes: string | null
          created_at: string
          doc_type: string
          id: string
          id_back_url: string | null
          id_front_url: string | null
          reviewed_at: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          user_id: string
        }
        Insert: {
          address_url?: string | null
          admin_notes?: string | null
          created_at?: string
          doc_type: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          reviewed_at?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          user_id: string
        }
        Update: {
          address_url?: string | null
          admin_notes?: string | null
          created_at?: string
          doc_type?: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          reviewed_at?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          user_id?: string
        }
        Relationships: []
      }
      mining_contracts: {
        Row: {
          accrued: number
          daily_earnings: number
          expires_at: string
          hash_rate: number
          id: string
          last_accrued_at: string
          plan_id: string
          price_paid: number
          purchased_at: string
          status: string
          user_id: string
        }
        Insert: {
          accrued?: number
          daily_earnings: number
          expires_at: string
          hash_rate: number
          id?: string
          last_accrued_at?: string
          plan_id: string
          price_paid: number
          purchased_at?: string
          status?: string
          user_id: string
        }
        Update: {
          accrued?: number
          daily_earnings?: number
          expires_at?: string
          hash_rate?: number
          id?: string
          last_accrued_at?: string
          plan_id?: string
          price_paid?: number
          purchased_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "mining_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_plans: {
        Row: {
          algorithm: string
          badge: string | null
          color: string | null
          created_at: string
          daily_earnings: number
          duration_days: number
          hash_rate: number
          id: string
          is_active: boolean
          maintenance_fee_pct: number
          name: string
          power_watts: number
          price: number
          sort_order: number
          tier: string
        }
        Insert: {
          algorithm?: string
          badge?: string | null
          color?: string | null
          created_at?: string
          daily_earnings: number
          duration_days: number
          hash_rate: number
          id?: string
          is_active?: boolean
          maintenance_fee_pct?: number
          name: string
          power_watts?: number
          price: number
          sort_order?: number
          tier?: string
        }
        Update: {
          algorithm?: string
          badge?: string | null
          color?: string | null
          created_at?: string
          daily_earnings?: number
          duration_days?: number
          hash_rate?: number
          id?: string
          is_active?: boolean
          maintenance_fee_pct?: number
          name?: string
          power_watts?: number
          price?: number
          sort_order?: number
          tier?: string
        }
        Relationships: []
      }
      news_feed: {
        Row: {
          id: string
          image_url: string | null
          published_at: string
          source: string | null
          summary: string | null
          title: string
          url: string | null
        }
        Insert: {
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string | null
          summary?: string | null
          title: string
          url?: string | null
        }
        Update: {
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string | null
          summary?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          broadcast: boolean
          category: string
          created_at: string
          id: string
          is_read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          broadcast?: boolean
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          broadcast?: boolean
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      platform_revenue: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          metadata: Json | null
          reference_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          currency: string
          email: string | null
          full_name: string | null
          id: string
          is_banned: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          language: string
          phone: string | null
          referral_code: string
          referred_by: string | null
          two_fa_enabled: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_banned?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          language?: string
          phone?: string | null
          referral_code?: string
          referred_by?: string | null
          two_fa_enabled?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_banned?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          language?: string
          phone?: string | null
          referral_code?: string
          referred_by?: string | null
          two_fa_enabled?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          level: number
          referred_id: string
          referrer_id: string
          total_commission: number
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          referred_id: string
          referrer_id: string
          total_commission?: number
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          referred_id?: string
          referrer_id?: string
          total_commission?: number
        }
        Relationships: []
      }
      saved_wallets: {
        Row: {
          address: string
          created_at: string
          currency: string
          id: string
          label: string
          network: string | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          currency: string
          id?: string
          label: string
          network?: string | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          currency?: string
          id?: string
          label?: string
          network?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          priority: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_admin: boolean
          sender_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          hash_rate: number
          referral_earned: number
          total_deposited: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          hash_rate?: number
          referral_earned?: number
          total_deposited?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          hash_rate?: number
          referral_earned?: number
          total_deposited?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          created_at: string
          currency: string | null
          fee: number
          fx_rate: number | null
          id: string
          method: string
          network: string | null
          ngn_amount: number | null
          platform_fee_usd: number | null
          processed_at: string | null
          status: Database["public"]["Enums"]["tx_status"]
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string | null
          fee?: number
          fx_rate?: number | null
          id?: string
          method?: string
          network?: string | null
          ngn_amount?: number | null
          platform_fee_usd?: number | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string | null
          fee?: number
          fx_rate?: number | null
          id?: string
          method?: string
          network?: string | null
          ngn_amount?: number | null
          platform_fee_usd?: number | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      kyc_status: "unverified" | "pending" | "approved" | "rejected"
      ticket_status: "open" | "pending" | "resolved" | "closed"
      tx_status:
        | "pending"
        | "processing"
        | "completed"
        | "rejected"
        | "cancelled"
      tx_type:
        | "deposit"
        | "withdrawal"
        | "mining_reward"
        | "referral_reward"
        | "plan_purchase"
        | "adjustment"
        | "transfer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      kyc_status: ["unverified", "pending", "approved", "rejected"],
      ticket_status: ["open", "pending", "resolved", "closed"],
      tx_status: [
        "pending",
        "processing",
        "completed",
        "rejected",
        "cancelled",
      ],
      tx_type: [
        "deposit",
        "withdrawal",
        "mining_reward",
        "referral_reward",
        "plan_purchase",
        "adjustment",
        "transfer",
      ],
    },
  },
} as const
