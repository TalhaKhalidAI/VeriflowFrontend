export interface InventoryRule {
  id: string;
  key_id?: string | null;
  user_id?: number | null;
  rule_name: string;
  matching_claim_key: string;
  expected_value: string;
  is_active: boolean;
  created_at?: string | null;
}

export interface InventoryRuleListResponse {
  items: InventoryRule[];
  limit: number;
  offset: number;
  total: number;
}

export interface CreateInventoryRulePayload {
  rule_name: string;
  matching_claim_key: string;
  expected_value: string;
  key_id?: string | null;
  user_id?: number | null;
  is_active?: boolean;
}

export interface UpdateInventoryRulePayload {
  rule_name?: string;
  matching_claim_key?: string;
  expected_value?: string;
  key_id?: string | null;
  user_id?: number | null;
  is_active?: boolean;
}

export interface EvaluateClaimsPayload {
  claims: Record<string, any>;
  key_id?: string | null;
}

export interface RuleViolationItem {
  rule_id: string;
  rule_name: string;
  reason?: string;
  claim_key?: string;
  expected_value?: string;
  actual_value?: any;
  message?: string;
}

export interface EvaluateClaimsResponse {
  is_valid: boolean;
  status?: string;
  evaluated_rules_count?: number;
  total_rules_evaluated?: number;
  passed_rules_count?: number;
  failed_rules_count?: number;
  violations?: RuleViolationItem[];
}
