/**
 * data.ts — типы данных для приложения
 */

export interface FunnelStage {
  id?: string;
  label: string;
  value: number;
  bench: number;
}

export interface AdChannel {
  name: string;
  budget: number;
  leads: number;
  roi: number;
  status: 'active' | 'paused' | 'archived';
}

export interface Tx {
  id?: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  date: string;
  description: string;
}

export interface Kpi {
  key: string;
  label: string;
  value: number | string;
  trend?: number;
  benchmark?: number;
}

export interface DbConn {
  name: string;
  host: string;
  port: number;
  active: boolean;
}

export interface ApiToken {
  name: string;
  token: string;
  scope: string[];
  created_at: string;
}

export interface Launch {
  id: number;
  name: string;
  expert: string | null;
  stage: 'unpacking' | 'brief' | 'niche' | 'plan' | 'ready';
  status: 'active' | 'paused' | 'archived';
  progress?: number;
  created_at: string;
  updated_at?: string;
}

export interface Brief {
  id?: number;
  launch_id: number;
  status: 'draft' | 'generated';
  summary: string | null;
  answers: Array<{ key: string; label: string; value: string }>;
}

export interface NicheAnalysis {
  id?: number;
  launch_id: number;
  niche_name: string;
  score: number;
  verdict: string;
  competitors: Competitor[];
}

export interface Competitor {
  name: string;
  students: number;
  check: number;
  rating: number;
  weak: string;
  power: number;
}

export interface LaunchPlan {
  launch_id: number;
  funnel: FunnelStage[];
  tariffs: Tariff[];
}

export interface Tariff {
  id?: number;
  name: string;
  price: number;
  note: string;
  hot: boolean;
  features: string[];
}
