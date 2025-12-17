/**
 * ORIGIN Multi-Agent Coordination System - Type Definitions
 *
 * This file defines the core types for coordinating the five-agent system:
 * - ChatGPT GPT-5.2 (Program Manager & Orchestrator)
 * - Gemini 3 (Multimodal Research & Contextual Reasoning)
 * - Gemini GEM (Origin Tech Curation & Segmentation)
 * - Grok 4 (Advanced Reasoning & Safety Cross-Check)
 * - DeepSeek V3.2 (Complex Reasoning & Problem-Solving)
 * - Claude Sonnet 4.5 (Full-Stack Implementation & Integration)
 */

export type AgentType =
  | 'chatgpt_moderator'
  | 'gemini3_research'
  | 'gemini_gem_curator'
  | 'grok4_safety'
  | 'deepseek_reasoning'
  | 'claude_builder';

export type TaskStatus =
  | 'pending'
  | 'routed'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'blocked';

export type WorkflowPhase =
  | 'intake_research'
  | 'conversion_preparation'
  | 'reasoning_analysis'
  | 'implementation'
  | 'validation_safety'
  | 'deployment';

export type ArtifactType =
  | 'raw_session'
  | 'curated_segment'
  | 'research_brief'
  | 'latex_document'
  | 'reasoning_report'
  | 'implementation_code'
  | 'validation_report'
  | 'deployment_artifact';

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  status: 'available' | 'busy' | 'offline';
  capabilities: string[];
  currentTasks: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  phase: WorkflowPhase;
  status: TaskStatus;
  assignedTo?: AgentType;
  createdBy: AgentType;
  createdAt: string;
  updatedAt: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  artifacts: string[];
  metadata: Record<string, unknown>;
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  description: string;
  content: string;
  createdBy: AgentType;
  createdAt: string;
  taskId: string;
  metadata: {
    source?: string;
    session?: string;
    segment?: string;
    scope?: string;
    version?: string;
    approvedBy?: AgentType;
    [key: string]: unknown;
  };
}

export interface RoutingDecision {
  taskId: string;
  targetAgent: AgentType;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string;
  instructions: string;
}

export interface ValidationRequest {
  id: string;
  artifactId: string;
  requestedBy: AgentType;
  validatorAgent: AgentType;
  validationType: 'safety' | 'correctness' | 'quality' | 'completeness';
  status: 'pending' | 'approved' | 'rejected';
  criteria?: string;
  requestedAt: string;
  feedback?: string;
  suggestions?: string;
  completedAt?: string;
  result?: {
    approved: boolean;
    findings: string[];
    recommendations: string[];
    report: string;
  };
}

export interface Escalation {
  id: string;
  taskId?: string;
  raisedBy: AgentType;
  issue: string;
  reason?: string;
  context: string;
  suggestedAction?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_review' | 'resolved';
  resolution?: string;
  resolvedBy?: AgentType;
  createdAt: string;
  resolvedAt?: string;
  relatedTaskId?: string;
  relatedArtifactId?: string;
}

export interface ProjectState {
  currentPhase: WorkflowPhase;
  phaseHistory: Array<{ phase: WorkflowPhase; timestamp: string }>;
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    byPhase: Record<string, number>;
  };
  artifacts: {
    total: number;
    byType: Record<string, number>;
  };
  validations: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  escalations: {
    total: number;
    active: number;
    bySeverity: Record<string, number>;
  };
  agentStatuses: Record<AgentType, string>;
  phaseProgress: number;
  lastUpdated: string;
}

export interface WorkProduct {
  taskId: string;
  agentId: AgentType;
  artifactType: ArtifactType;
  content: string;
  metadata: Record<string, unknown>;
  requiresValidation: boolean;
  validationType?: 'safety' | 'correctness' | 'quality' | 'completeness';
}

export interface AgentMessage {
  id: string;
  from: AgentType;
  to: AgentType | 'all';
  type: 'request' | 'response' | 'notification' | 'escalation';
  subject: string;
  content: string;
  taskId?: string;
  artifactId?: string;
  timestamp: string;
  requiresResponse: boolean;
}

export interface Message {
  id: string;
  from: AgentType;
  to: AgentType;
  subject: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: string;
  read: boolean;
  relatedTaskId?: string;
  relatedArtifactId?: string;
}
