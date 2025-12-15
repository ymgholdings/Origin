SOURCE: ORIGIN / Aureon XI
SESSION: 001
SEGMENT: 5 of 18
SCOPE: Shared Data Models and Contracts (EvidenceObject, Hypothesis, ExperimentResult, CausalGraph, FactUnit, ModelArtifact, TaskSpec, TaskResult, ReliabilityReport, ImprovementCandidate)
NOTE: All technical notation preserved verbatim.

## 1. Shared Data Model and Contracts

Types are conceptual, but you can lift them almost directly into TypeScript, Protobuf, or JSON Schema.

#### 1.1 EvidenceObject

```ts
type SourceTrustLevel = "low" | "medium" | "high" | "critical";

interface EvidenceObject {
 id: string;
 // globally unique
 source_id: string; // URL, system ID, feed ID
 source_type: "api" | "file" | "stream" | "human" |
 "model";
 ingested_at: string; // ISO timestamp
 content_type: "text" | "json" | "table" | "code" | "image" | "audio" | "video";
 content_ref: string; // pointer to blob, text, or document ID
 raw_hash: string;
 // content hash for integrity

 provenance: {
 path: string[]; // chain of systems that handled it
 signature_chain?: string[];
 // cryptographic signatures
 };

 quality_priors: {
 trust_level: SourceTrustLevel;
 peer_reviewed?: boolean;
 institutional_reputation?: number; // 0 to 1
 };

 regulatory_tags: string[];
 // "PII", "HIPAA", "ITAR", etc.
 domain_tags: string[]; // "finance", "physics", "politics"

 annotations?: Record<string, any>;
 // model or human comments
}

Used by: INGRESS, Aureon, Synthesis, SENTINEL.

1.2 Hypothsis

interface Hypothesis {
 id: string;
 created_by: "aureon" | "human" | "external_model";
 created_at: string;

 statement: string; // natural language
 formal_representation?: string;
 // LaTeX or logical form
 domain: string; // "cosmology", "economics", etc.

 parameters: {
 name: string;
 description: string;
 range?: { min: number; max: number };
 nominal?: number;
 }[];

 scope: {
 temporal?: { from?: string; to?: string };
 spatial?: string;
 conditions?: string[]; // "under low temperature", etc.
 };

 evidence_links: {
 evidence_id: string;
 role: "support" | "refute" | "background";
 weight: number; // 0 to 1
 }[];

 confidence: {
 value: number; // 0 to 1
 method: "bayesian" | "heuristic" |
 "ensemble" | "unknown";
 last_updated: string;
 };

 status: "proposed" | "under_test" | "supported" | "contested" | "rejected";
}

Used by: Aureon, Synthesis, ONE, SENTINEL.

1.3 ExperimentResult

interface ExperimentResult {
 id: string;
 hypothesis_id: string;
 executed_by: string;
 // job or agent id
 executed_at: string;

 input_config: Record<string, any>;
 metrics: Record<string, number>;
 raw_output_ref: string;
 // pointer to full logs or artifacts

 success: boolean;
 failure_reason?: string;

 evidence_links: {
 evidence_id: string;
 role: "generated" | "comparison" |
 "derived_from";
 }[];

 quality_score: number; // internal quality heuristic
}

Used by: Aureon, Synthesis, SENTINEL.

1.4 CausalGraft

interface CausalNode {
 id: string;
 name: string;
 description?: string;
 node_type?: "variable" | "intervention" | "outcome";
}

interface CausalEdge {
 from: string;
 to: string;
 effect_sign?: "positive" |
 "negative" | "unknown";
 strength?: number; // 0 to 1
 confidence?: number; // 0 to 1
}

interface CausalGraph {
 id: string;
 domain: string;
 created_at: string;
 created_by: string;

 nodes: CausalNode[];
 edges: CausalEdge[];

 associated_hypotheses: string[];
 evidence_links: { evidence_id: string; weight: number }[];
 model_refs?: string[]; // pointers to functional models
}

Used by: Aureon, Synthesis, ONE.

1.5 FaceUnit (ONE Core atom)

interface FactUnit {
 id: string;
 statement: string; // human readable
 formal_representation?: string;

 domain: string;
 scope: {
 temporal?: { from?: string; to?: string };
 spatial?: string;
 conditions?: string[];
 };

 uncertainty: {
 probability?: number;
 // 0 to 1
 interval?: { lower: number; upper: number };
 method: string;
 };

 evidence_links: {
 evidence_id: string;
 role: "primary" | "secondary" | "meta";
 weight: number;
 }[];

 causal_graph_ids?: string[];
 origin_hypothesis_ids?: string[];

 version_info: {
 version: number;
 parent_version?: number;
 created_at: string;
 };

 promotion_metadata: {
 promoted_by: string; // "synthesis-layer", "human-review"
 promoted_at: string;
 sentinel_approval_id?: string;
 };

 tags: string[];
}

Used by: ONE, Synthesis, SENTINEL, ORIGIN Core.

1.6 ModelArtifact

interface ModelArtifact {
 id: string;
 model_type: "llm" | "regression" |
 "simulation" | "policy" | "other";
 name: string;
 version: string;

 domain: string;
 training_data_refs: string[];
 // EvidenceObject IDs or dataset ids
 metrics: Record<string, number>; // accuracy, F1, etc.

 interface_spec: {
 input_schema: Record<string, any>;
 output_schema: Record<string, any>;
 };

 deployment_info?: {
 location: string; // endpoint or internal path
 runtime: string; // "python", "rust", etc.
 };
 lineage: {
 parent_model_ids?: string[];
 creation_method: "manual" | "auto_search" | "distillation";
 created_at: string;
 };

 reliability_score?: number;
 // 0 to 1, from SENTINEL
}

Used by: Aureon, External Model Mesh, SENTINEL, ONE.

1.7 TaskSpec and TaskResult

type TaskType =
 | "ingest"
 | "analyze"
 | "simulate"
 | "train_model"
 | "validate"
 |
 "synthesize"
 | "promote"
 | "audit"
 | "maintenance";

interface TaskSpec {
 id: string;
 type: TaskType;
 created_at: string;
 created_by: string;
 // upstream task or human

 priority: number; // 0 to 1
 risk_level: "low" | "medium" | "high" | "critical";
 inputs: {
 evidence_ids?: string[];
 hypothesis_ids?: string[];
 fact_ids?: string[];
 model_ids?: string[];
 parameters?: Record<string, any>;
 };

 required_capabilities: string[];
 // "causal_reasoning", "numerics", etc.

 constraints?: {
 max_cost?: number;
 deadline?: string;
 policy_context?: string; // pointer to rules
 };
}

interface TaskResult {
 task_id: string;
 status: "success" | "failed" |
 "partial" | "cancelled";
 started_at: string;
 completed_at: string;
 outputs: {
 new_evidence_ids?: string[];
 new_hypothesis_ids?: string[];
 new_fact_ids?: string[];
 new_model_ids?: string[];
 new_causal_graph_ids?: string[];
 };

 metrics: Record<string, number>;
 logs_ref: string;
 error_message?: string;
}

Used by: ORIGIN Core, all compute nodes, SENTINEL.

1.8 ReliabilityReport and ImprovementCandidate

interface ReliabilityReport {
 id: string;
 target_type: "fact" | "model" | "hypothesis" | "pipeline" | "service";
 target_id: string;
 created_at: string;
 created_by: "sentinel";

 reliability_score: number;
 // 0 to 1
 risk_score: number; // 0 to 1

 evidence: {
 metric: string;
 value: number;
 reference?: string;
 }[];
 recommendations?: string[];
}

interface ImprovementCandidate {
 id: string;
 created_at: string;
 created_by: "sentinel" | "origin-core" | "human";

 target_type: "model" | "policy" |
 "schema" | "scheduler" | "pipeline";
 target_id?: string;

 proposal: {
 description: string;
 config_patch?: Record<string, any>;
 };

 justification: string;
 expected_impact: {
 reliability_delta?: number;
 cost_delta?: number;
 coverage_delta?: number;
 };

 status: "proposed" | "sandbox" | "shadow" | "rolled_out" | "rejected";
}

Used by: SENTINEL, ORIGIN Core, Synthesis, ONE.







