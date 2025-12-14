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
