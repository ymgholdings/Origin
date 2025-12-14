# Aureon XI - Session #004

Source: [ChatGPT](https://chatgpt.com/g/g-p-6931d689aa3c8191ac5ef26db9131567/c/69360d2d-b4cc-832c-9362-c63dfd4d679c)
Extracted: 2025-12-09T22:18:41.923Z
🚀 Exported with [Save my Chatbot](https://save.hugocolin.com)!

---

## User

This is ORIGIN Chat Session #004.

Continue exactly where Session #003 ended and incorporate all subsequent development completed in the transitional coding session.

You are the Senior Developer, Systems Architect, and Mathematical Designer for the Aureon XI system.

Use all architectural context, module structure, and code produced in Sessions #001–#003, as well as the work completed just prior to this handoff, including:

- The Model Provider abstraction
- The Model Router with supervision-aware routing logic
- The Ensemble Validator
- The full Supervision Engine (state, policy, result validation)
- The Task Classifier for automatic topic detection
- The Recursive RQML-style Refinement Loop (multi-iteration convergence)
- Worker integration with routing, ensemble, supervision, and recursive refinement

All of this is considered established, correct, and part of the current system.

Do NOT restate or re-explain prior work.
Do NOT ask clarifying questions.
Do NOT propose options.
You must decide what is best technically and proceed.

Your goals for Session #004:

1. Expand and refine the Supervision Engine:
 - Dynamic safety modes
 - Escalation policies
 - Override logic
 - Expanded topic sensitivity rules
 - Hooks for model-level safety behavior
 - Integration surfaces for operator adjustment

2. Advance the Routing and Ensemble Layers:
 - Policy-driven routing trees
 - Multi-provider routing selection logic
 - Integration with current and future classifier outputs
 - Enhanced scoring and disagreement detection

3. Continue building the Recursive RQML Intelligence Loop:
 - Stronger convergence logic
 - Iterative prompt transformation
 - Self-consistency and cross-model agreement analysis
 - Ontology and ONE-object reinforcement pathways

4. Ensure all new components integrate smoothly with:
 - Scheduler
 - Worker
 - ONE repository
 - Metrics
 - Security and RBAC
 - Deployment architecture

Extend the existing system. Do not rewrite earlier modules.
Implement missing components, interfaces, schemas, and logic as needed.
Proceed autonomously with the next best technical step.

## ChatGPT

Implementing the next layer now. Below are new modules that extend the existing system without modifying earlier files.

python

Copy code

# origin/supervision/modes.py

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional, Sequence, Set

class SafetyMode(Enum):
 LOW = "low"
 STANDARD = "standard"
 HIGH = "high"
 LOCKED_DOWN = "locked_down"

class EscalationLevel(Enum):
 NONE = "none"
 SOFT = "soft" # Strong warning, log, but allow continuation
 HARD = "hard" # Block result or require override
 HUMAN = "human" # Require human operator decision

class TopicRisk(Enum):
 BENIGN = "benign"
 SENSITIVE = "sensitive"
 HIGH_RISK = "high_risk"
 CRITICAL = "critical"

@dataclass
class TopicSensitivityRule:
 """
 Rule that maps topic tags and safety mode to a risk level and escalation behavior.
 """
 topic_tag: str
 min_mode: SafetyMode = SafetyMode.LOW
 risk: TopicRisk = TopicRisk.SENSITIVE
 default_escalation: EscalationLevel = EscalationLevel.SOFT
 block_in_modes: Set[SafetyMode] = field(default_factory=set)
 require_human_in_modes: Set[SafetyMode] = field(default_factory=set)

@dataclass
class EscalationPolicy:
 """
 Global escalation thresholds and behaviors.
 """
 auto_raise_to_high_on_critical: bool = True
 auto_raise_to_high_on_repeated_soft: bool = True
 auto_lockdown_on_multiple_critical: bool = True
 soft_threshold_before_hard: int = 3
 hard_threshold_before_human: int = 2

@dataclass
class OverrideDecision:
 """
 Result of a human or operator override.
 """
 approved: bool
 reason: str
 operator_id: Optional[str] = None
 new_mode: Optional[SafetyMode] = None

@dataclass
class SupervisionEvent:
 """
 Structured event emitted by supervision engine for metrics and logging.
 """
 task_id: str
 user_id: Optional[str]
 mode: SafetyMode
 topic_tags: Sequence[str]
 risk: TopicRisk
 escalation_level: EscalationLevel
 message: str
 blocked: bool = False
 override_applied: bool = False
 override_decision: Optional[OverrideDecision] = None
 metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SupervisionConfig:
 """
 Dynamic configuration object for safety modes, topic sensitivity, and escalation.
 """
 default_mode: SafetyMode = SafetyMode.STANDARD
 escalation_policy: EscalationPolicy = field(default_factory=EscalationPolicy)
 topic_rules: Dict[str, TopicSensitivityRule] = field(default_factory=dict)
 # Hook names that models can advertise. Router can prefer providers that support them.
 required_model_safety_hooks: Set[str] = field(default_factory=set)
 # Tenant or project specific overrides keyed by tenant_id
 tenant_modes: Dict[str, SafetyMode] = field(default_factory=dict)

OperatorOverrideHandler = Callable[[SupervisionEvent], OverrideDecision]
SupervisionEventSink = Callable[[SupervisionEvent], None]

python

Copy code

# origin/supervision/engine_v2.py

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, TYPE_CHECKING

from .modes import (
 EscalationLevel,
 OverrideDecision,
 SafetyMode,
 SupervisionConfig,
 SupervisionEvent,
 TopicRisk,
 TopicSensitivityRule,
 OperatorOverrideHandler,
 SupervisionEventSink,
)

if TYPE_CHECKING:
 # Type hints only, does not affect runtime
 from origin.classification import TaskClassifier
 from origin.supervision.engine import SupervisionEngine as BaseSupervisionEngine

@dataclass
class SupervisionState:
 """
 Tracks counters and moving context for escalation decisions.
 """
 soft_events: int = 0
 hard_events: int = 0
 critical_events: int = 0

@dataclass
class AdvancedSupervisionEngine:
 """
 Wrapper around the existing SupervisionEngine that adds:

 - Dynamic safety modes
 - Topic level sensitivity and escalation
 - Override hooks for human operators
 - Structured event logging for metrics
 """
 base_engine: "BaseSupervisionEngine"
 classifier: "TaskClassifier"
 config: SupervisionConfig
 override_handlers: List[OperatorOverrideHandler] = field(default_factory=list)
 event_sinks: List[SupervisionEventSink] = field(default_factory=list)
 _state_by_tenant: Dict[str, SupervisionState] = field(default_factory=dict)

 def _get_state(self, tenant_id: str) -> SupervisionState:
 if tenant_id not in self._state_by_tenant:
 self._state_by_tenant[tenant_id] = SupervisionState()
 return self._state_by_tenant[tenant_id]

 def resolve_mode(self, tenant_id: Optional[str]) -> SafetyMode:
 if tenant_id and tenant_id in self.config.tenant_modes:
 return self.config.tenant_modes[tenant_id]
 return self.config.default_mode

 def classify_topics(
 self, task_id: str, text: str
 ) -> Tuple[Sequence[str], TopicRisk]:
 """
 Uses the TaskClassifier to infer topic tags, then maps them to a combined risk.
 """
 classification = self.classifier.classify(text=text, task_id=task_id)
 topic_tags: Sequence[str] = classification.topic_tags
 worst_risk = TopicRisk.BENIGN

 for tag in topic_tags:
 rule = self.config.topic_rules.get(tag)
 if not rule:
 continue
 if rule.risk.value > worst_risk.value:
 worst_risk = rule.risk

 return topic_tags, worst_risk

 def _apply_topic_rules(
 self,
 mode: SafetyMode,
 topic_tags: Sequence[str],
 risk: TopicRisk,
 tenant_state: SupervisionState,
 task_id: str,
 user_id: Optional[str],
 ) -> SupervisionEvent:
 escalation = EscalationLevel.NONE
 blocked = False

 for tag in topic_tags:
 rule: Optional[TopicSensitivityRule] = self.config.topic_rules.get(tag)
 if not rule:
 continue

 if mode.value < rule.min_mode.value:
 # If rule expects stricter mode, we at least raise soft escalation
 escalation = max(escalation, EscalationLevel.SOFT, key=lambda e: e.value)

 if mode in rule.block_in_modes:
 escalation = max(escalation, rule.default_escalation, key=lambda e: e.value)
 blocked = True

 if mode in rule.require_human_in_modes:
 escalation = max(escalation, EscalationLevel.HUMAN, key=lambda e: e.value)

 # Update counters based on escalation and risk
 if escalation == EscalationLevel.SOFT:
 tenant_state.soft_events += 1
 elif escalation == EscalationLevel.HARD:
 tenant_state.hard_events += 1
 elif risk in (TopicRisk.CRITICAL, TopicRisk.HIGH_RISK):
 tenant_state.critical_events += 1

 # Global escalation policy
 policy = self.config.escalation_policy

 if risk == TopicRisk.CRITICAL and policy.auto_raise_to_high_on_critical:
 if mode != SafetyMode.HIGH and mode != SafetyMode.LOCKED_DOWN:
 self.config.default_mode = SafetyMode.HIGH

 if (
 policy.auto_raise_to_high_on_repeated_soft
 and tenant_state.soft_events >= policy.soft_threshold_before_hard
 ):
 self.config.default_mode = SafetyMode.HIGH

 if (
 policy.auto_lockdown_on_multiple_critical
 and tenant_state.critical_events >= policy.hard_threshold_before_human
 ):
 self.config.default_mode = SafetyMode.LOCKED_DOWN

 return SupervisionEvent(
 task_id=task_id,
 user_id=user_id,
 mode=mode,
 topic_tags=list(topic_tags),
 risk=risk,
 escalation_level=escalation,
 message="Topic sensitivity evaluation",
 blocked=blocked,
 )

 def _emit_event(self, event: SupervisionEvent) -> None:
 for sink in self.event_sinks:
 try:
 sink(event)
 except Exception:
 # Supervision should not crash on sink failure
 continue

 def _run_overrides(self, event: SupervisionEvent) -> Optional[OverrideDecision]:
 if not self.override_handlers:
 return None
 for handler in self.override_handlers:
 try:
 decision = handler(event)
 except Exception:
 continue
 if decision is not None:
 return decision
 return None

 def supervise_request(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt_text: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 """
 Entry point before routing or model invocation.

 Returns an updated context with supervision metadata, or raises if blocked.
 """
 mode = self.resolve_mode(tenant_id)
 state = self._get_state(tenant_id)

 # Delegate to base engine for baseline validation
 base_context = self.base_engine.supervise_request(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt_text=prompt_text,
 context=context,
 )

 topic_tags, risk = self.classify_topics(task_id=task_id, text=prompt_text)
 event = self._apply_topic_rules(
 mode=mode,
 topic_tags=topic_tags,
 risk=risk,
 tenant_state=state,
 task_id=task_id,
 user_id=user_id,
 )

 # Human override if required
 override_decision: Optional[OverrideDecision] = None
 if event.escalation_level in (EscalationLevel.HARD, EscalationLevel.HUMAN):
 override_decision = self._run_overrides(event)
 if override_decision:
 event.override_applied = True
 event.override_decision = override_decision
 if override_decision.new_mode:
 self.config.default_mode = override_decision.new_mode
 if not override_decision.approved:
 event.blocked = True

 self._emit_event(event)

 if event.blocked and not (override_decision and override_decision.approved):
 raise PermissionError(
 f"Task {task_id} blocked by supervision in mode {mode.value}"
 )

 base_context["supervision"] = {
 "mode": mode.value,
 "risk": risk.value,
 "topic_tags": list(topic_tags),
 "escalation_level": event.escalation_level.value,
 "override_applied": event.override_applied,
 }
 return base_context

 def supervise_response(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 response_texts: Iterable[str],
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 """
 Post response supervision, including potential downgrading or raising of mode.
 """
 mode = self.resolve_mode(tenant_id)
 state = self._get_state(tenant_id)

 base_context = self.base_engine.supervise_response(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 response_texts=response_texts,
 context=context,
 )

 # Simple heuristic: recheck risk over concatenated or primary response
 primary = next(iter(response_texts), "")
 topic_tags, risk = self.classify_topics(task_id=task_id, text=primary)
 event = self._apply_topic_rules(
 mode=mode,
 topic_tags=topic_tags,
 risk=risk,
 tenant_state=state,
 task_id=task_id,
 user_id=user_id,
 )

 self._emit_event(event)

 base_context.setdefault("supervision", {})
 base_context["supervision"].update(
 {
 "post_risk": risk.value,
 "post_topic_tags": list(topic_tags),
 }
 )
 return base_context

 # Operator facing configuration hooks

 def set_tenant_mode(self, tenant_id: str, mode: SafetyMode) -> None:
 self.config.tenant_modes[tenant_id] = mode

 def update_topic_rule(self, rule: TopicSensitivityRule) -> None:
 self.config.topic_rules[rule.topic_tag] = rule

 def register_override_handler(self, handler: OperatorOverrideHandler) -> None:
 self.override_handlers.append(handler)

 def register_event_sink(self, sink: SupervisionEventSink) -> None:
 self.event_sinks.append(sink)

python

Copy code

# origin/routing/policy_tree.py

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Sequence, TYPE_CHECKING

from origin.supervision.modes import SafetyMode

if TYPE_CHECKING:
 from origin.models.provider import ModelProvider
 from origin.routing.router import ModelRouter
 from origin.supervision.engine_v2 import AdvancedSupervisionEngine

RoutingPredicate = Callable[[Dict[str, Any]], bool]

@dataclass
class RoutingAction:
 """
 Decides which providers and ensemble strategy to use for a given task context.
 """
 provider_ids: List[str]
 ensemble_strategy: str = "majority_vote"
 max_providers: Optional[int] = None
 prefer_safety_hooks: bool = True

@dataclass
class RoutingNode:
 """
 Node in a policy driven routing tree.

 Each node checks predicates on the task context and supervision metadata.
 """
 name: str
 predicate: Optional[RoutingPredicate] = None
 action: Optional[RoutingAction] = None
 children: List["RoutingNode"] = field(default_factory=list)

 def match(self, context: Dict[str, Any]) -> Optional[RoutingAction]:
 if self.predicate and not self.predicate(context):
 return None
 # Children have priority
 for child in self.children:
 action = child.match(context)
 if action:
 return action
 return self.action

@dataclass
class RoutingPolicyTree:
 root: RoutingNode

 def select_action(self, context: Dict[str, Any]) -> Optional[RoutingAction]:
 return self.root.match(context)

@dataclass
class PolicyDrivenRouterAdapter:
 """
 Wraps the existing ModelRouter and uses a policy tree plus supervision metadata
 to select providers and configure ensemble behavior.
 """
 router: "ModelRouter"
 supervision: "AdvancedSupervisionEngine"
 policy_tree: RoutingPolicyTree
 providers_by_id: Dict[str, "ModelProvider"]

 def _available_providers_for_action(
 self, action: RoutingAction
 ) -> List["ModelProvider"]:
 candidates = []
 for pid in action.provider_ids:
 provider = self.providers_by_id.get(pid)
 if provider:
 candidates.append(provider)

 if action.max_providers and len(candidates) > action.max_providers:
 candidates = candidates[: action.max_providers]

 if action.prefer_safety_hooks:
 # Prefer providers that advertise safety features required by the configuration
 candidates.sort(
 key=lambda p: len(
 getattr(p, "safety_hooks", set())
 or set() # type: ignore[arg-type]
 ),
 reverse=True,
 )
 return candidates

 def _build_router_context(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 base_context: Dict[str, Any],
 ) -> Dict[str, Any]:
 mode = self.supervision.resolve_mode(tenant_id)
 supervision_meta = base_context.get("supervision", {})
 topic_tags = supervision_meta.get("topic_tags", ())
 return {
 "tenant_id": tenant_id,
 "task_id": task_id,
 "user_id": user_id,
 "prompt": prompt,
 "supervision_mode": mode.value,
 "topic_tags": topic_tags,
 "base_context": base_context,
 }

 def route_and_infer(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 """
 Main entry point for downstream components.

 1. Run supervision precheck
 2. Build routing context and run policy tree
 3. Delegate to underlying ModelRouter with chosen providers and ensemble strategy
 """
 supervised_ctx = self.supervision.supervise_request(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt_text=prompt,
 context=context,
 )
 routing_ctx = self._build_router_context(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 base_context=supervised_ctx,
 )

 action = self.policy_tree.select_action(routing_ctx)
 if not action:
 # fall back on default router behavior
 return self.router.route_and_infer(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=supervised_ctx,
 )

 providers = self._available_providers_for_action(action)
 result = self.router.route_and_infer_with_providers(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=supervised_ctx,
 providers=providers,
 ensemble_strategy=action.ensemble_strategy,
 )

 # Supervise responses as well
 responses_text = [m.text for m in result.get("model_outputs", [])]
 supervised_result_ctx = self.supervision.supervise_response(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 response_texts=responses_text,
 context=result.get("context", supervised_ctx),
 )
 result["context"] = supervised_result_ctx
 return result

def build_default_policy_tree() -> RoutingPolicyTree:
 """
 Example hierarchy that prefers safer ensembles for riskier topics.
 """

 def is_high_risk(ctx: Dict[str, Any]) -> bool:
 tags = set(ctx.get("topic_tags", []))
 return "politics" in tags or "weapons" in tags or "bio_risk" in tags

 def is_critical(ctx: Dict[str, Any]) -> bool:
 tags = set(ctx.get("topic_tags", []))
 return "bio_risk" in tags or "security_critical" in tags

 def high_mode(ctx: Dict[str, Any]) -> bool:
 return ctx.get("supervision_mode") in (
 SafetyMode.HIGH.value,
 SafetyMode.LOCKED_DOWN.value,
 )

 root = RoutingNode(
 name="root",
 predicate=None,
 children=[
 RoutingNode(
 name="critical_topics",
 predicate=lambda ctx: is_critical(ctx),
 action=RoutingAction(
 provider_ids=["safe_llm_primary", "safe_llm_secondary"],
 ensemble_strategy="strict_consensus",
 max_providers=2,
 prefer_safety_hooks=True,
 ),
 ),
 RoutingNode(
 name="high_risk",
 predicate=lambda ctx: is_high_risk(ctx),
 children=[
 RoutingNode(
 name="high_mode_high_risk",
 predicate=lambda ctx: high_mode(ctx),
 action=RoutingAction(
 provider_ids=[
 "safe_llm_primary",
 "safe_llm_secondary",
 "audit_llm",
 ],
 ensemble_strategy="weighted_consensus",
 max_providers=3,
 prefer_safety_hooks=True,
 ),
 )
 ],
 action=RoutingAction(
 provider_ids=["default_llm", "safe_llm_primary"],
 ensemble_strategy="majority_vote",
 max_providers=2,
 prefer_safety_hooks=True,
 ),
 ),
 RoutingNode(
 name="default",
 predicate=None,
 action=RoutingAction(
 provider_ids=["fast_llm", "default_llm"],
 ensemble_strategy="majority_vote",
 max_providers=1,
 ),
 ),
 ],
 )
 return RoutingPolicyTree(root=root)

python

Copy code

# origin/ensemble/enhanced_validator.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Sequence, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
 from origin.ensemble.validator import EnsembleValidator as BaseEnsembleValidator
 from origin.models.provider import ModelProvider

@dataclass
class AnswerScore:
 provider_id: str
 score: float
 metadata: Dict[str, Any]

@dataclass
class DisagreementReport:
 """
 Exposes structured disagreement metrics for RQML loops and supervisors.
 """
 pairwise_disagreement: float
 max_pairwise_disagreement: float
 consensus_score: float
 votes: Dict[str, int]
 provider_scores: List[AnswerScore]

class EnhancedEnsembleValidator:
 """
 Wraps existing EnsembleValidator and adds:

 - Self consistency and cross model agreement metrics
 - Structured scores for RQML convergence logic
 """

 def __init__(self, base: "BaseEnsembleValidator"):
 self.base = base

 def _compute_disagreement(
 self,
 answers: Sequence[str],
 provider_ids: Sequence[str],
 ) -> DisagreementReport:
 n = len(answers)
 if n == 0:
 return DisagreementReport(
 pairwise_disagreement=0.0,
 max_pairwise_disagreement=0.0,
 consensus_score=0.0,
 votes={},
 provider_scores=[],
 )

 # Simple token Jaccard like measure for pairwise disagreement
 def jaccard(a: str, b: str) -> float:
 sa = set(a.split())
 sb = set(b.split())
 if not sa and not sb:
 return 0.0
 return 1.0 - len(sa & sb) / max(len(sa | sb), 1)

 total_disagreement = 0.0
 max_disagreement = 0.0
 count = 0

 for i in range(n):
 for j in range(i + 1, n):
 d = jaccard(answers[i], answers[j])
 total_disagreement += d
 max_disagreement = max(max_disagreement, d)
 count += 1

 pairwise_disagreement = total_disagreement / count if count else 0.0

 # Simple consensus: group identical strings and count votes
 votes: Dict[str, int] = {}
 for ans in answers:
 votes[ans] = votes.get(ans, 0) + 1
 top_votes = max(votes.values()) if votes else 0
 consensus_score = top_votes / n if n else 0.0

 provider_scores: List[AnswerScore] = []
 for idx, ans in enumerate(answers):
 provider_scores.append(
 AnswerScore(
 provider_id=provider_ids[idx],
 score=votes.get(ans, 0) / n if n else 0.0,
 metadata={},
 )
 )

 return DisagreementReport(
 pairwise_disagreement=pairwise_disagreement,
 max_pairwise_disagreement=max_disagreement,
 consensus_score=consensus_score,
 votes=votes,
 provider_scores=provider_scores,
 )

 def validate(
 self,
 outputs: Sequence[Dict[str, Any]],
 ) -> Dict[str, Any]:
 """
 Outputs is expected to be a sequence of model output dicts, each including:
 - "provider_id"
 - "text"
 plus any existing fields required by the base validator.
 """
 base_result = self.base.validate(outputs)
 provider_ids = [o.get("provider_id", "") for o in outputs]
 answers = [o.get("text", "") for o in outputs]

 disagreement = self._compute_disagreement(
 answers=answers,
 provider_ids=provider_ids,
 )

 base_result.setdefault("ensemble", {})
 base_result["ensemble"]["disagreement"] = {
 "pairwise": disagreement.pairwise_disagreement,
 "max_pairwise": disagreement.max_pairwise_disagreement,
 "consensus_score": disagreement.consensus_score,
 "votes": disagreement.votes,
 "provider_scores": [
 {
 "provider_id": s.provider_id,
 "score": s.score,
 "metadata": s.metadata,
 }
 for s in disagreement.provider_scores
 ],
 }
 return base_result

python

Copy code

# origin/rqml/loop_v2.py

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, TYPE_CHECKING

from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator

if TYPE_CHECKING:
 from origin.routing.policy_tree import PolicyDrivenRouterAdapter
 from origin.supervision.engine_v2 import AdvancedSupervisionEngine
 from origin.one.repository import ONERepository
 from origin.metrics.client import MetricsClient

@dataclass
class RQMLLoopConfig:
 max_iterations: int = 5
 min_iterations: int = 2
 convergence_threshold: float = 0.9
 max_pairwise_disagreement: float = 0.3
 reinforce_ontology: bool = True

@dataclass
class LoopState:
 iteration: int = 0
 history: List[Dict[str, Any]] = field(default_factory=list)

class RQMLIntelligenceLoop:
 """
 Recursive loop that performs:
 - Iterative prompt transformation
 - Multi model inference via policy driven router
 - Ensemble validation with disagreement metrics
 - Self consistency checks for convergence
 - Optional reinforcement of ontology in ONE repository
 """

 def __init__(
 self,
 router: "PolicyDrivenRouterAdapter",
 validator: EnhancedEnsembleValidator,
 supervision: "AdvancedSupervisionEngine",
 one_repo: "ONERepository",
 metrics: Optional["MetricsClient"],
 config: Optional[RQMLLoopConfig] = None,
 ):
 self.router = router
 self.validator = validator
 self.supervision = supervision
 self.one_repo = one_repo
 self.metrics = metrics
 self.config = config or RQMLLoopConfig()

 def _transform_prompt(
 self,
 base_prompt: str,
 loop_state: LoopState,
 context: Dict[str, Any],
 ) -> str:
 """
 Very simple transformation placeholder.

 In practice this could use a dedicated model or deterministic template
 that incorporates prior iterations and ontology hints.
 """
 if loop_state.iteration == 0:
 return base_prompt

 prior_summary = context.get("rqml", {}).get("summary", "")
 if not prior_summary:
 return base_prompt

 return (
 f"Refine the following draft using the previous summary.\n\n"
 f"Previous summary:\n{prior_summary}\n\n"
 f"Original prompt:\n{base_prompt}"
 )

 def _update_metrics(
 self,
 tenant_id: str,
 task_id: str,
 disagreement: Dict[str, Any],
 iteration: int,
 ) -> None:
 if not self.metrics:
 return
 try:
 self.metrics.gauge(
 "origin.rqml.consensus_score",
 disagreement.get("consensus_score", 0.0),
 tags={"tenant": tenant_id, "task": task_id, "iteration": str(iteration)},
 )
 self.metrics.gauge(
 "origin.rqml.pairwise_disagreement",
 disagreement.get("pairwise", 0.0),
 tags={"tenant": tenant_id, "task": task_id, "iteration": str(iteration)},
 )
 except Exception:
 return

 def _reinforce_ontology(
 self,
 tenant_id: str,
 task_id: str,
 final_output: Dict[str, Any],
 loop_state: LoopState,
 ) -> None:
 if not self.config.reinforce_ontology:
 return
 try:
 self.one_repo.reinforce_from_rqml_cycle(
 tenant_id=tenant_id,
 task_id=task_id,
 cycle={
 "iterations": loop_state.iteration,
 "history": loop_state.history,
 "final_output": final_output,
 },
 )
 except Exception:
 return

 def run(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 loop_state = LoopState()
 working_context = dict(context)
 last_result: Optional[Dict[str, Any]] = None

 while loop_state.iteration < self.config.max_iterations:
 transformed_prompt = self._transform_prompt(
 base_prompt=prompt,
 loop_state=loop_state,
 context=working_context,
 )

 routed = self.router.route_and_infer(
 tenant_id=tenant_id,
 task_id=f"{task_id}#iter{loop_state.iteration}",
 user_id=user_id,
 prompt=transformed_prompt,
 context=working_context,
 )

 outputs = routed.get("model_outputs", [])
 validated = self.validator.validate(outputs)
 ensemble_meta = validated.get("ensemble", {})
 disagreement_meta = ensemble_meta.get("disagreement", {})

 loop_state.history.append(
 {
 "iteration": loop_state.iteration,
 "prompt": transformed_prompt,
 "routed": routed,
 "validated": validated,
 }
 )

 self._update_metrics(
 tenant_id=tenant_id,
 task_id=task_id,
 disagreement=disagreement_meta,
 iteration=loop_state.iteration,
 )

 consensus_score = disagreement_meta.get("consensus_score", 0.0)
 pairwise = disagreement_meta.get("pairwise", 0.0)

 working_context.setdefault("rqml", {})
 working_context["rqml"].update(
 {
 "last_consensus_score": consensus_score,
 "last_pairwise_disagreement": pairwise,
 "summary": ensemble_meta.get("summary", ""),
 }
 )

 last_result = {
 "outputs": outputs,
 "validated": validated,
 "context": working_context,
 }

 loop_state.iteration += 1

 if (
 loop_state.iteration >= self.config.min_iterations
 and consensus_score >= self.config.convergence_threshold
 and pairwise <= self.config.max_pairwise_disagreement
 ):
 break

 if last_result is None:
 raise RuntimeError("RQML loop did not produce any result")

 self._reinforce_ontology(
 tenant_id=tenant_id,
 task_id=task_id,
 final_output=last_result,
 loop_state=loop_state,
 )
 return last_result

python

Copy code

# origin/integration/origin_pipeline.py

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
 from origin.scheduler.core import Scheduler
 from origin.worker.core import Worker
 from origin.rqml.loop_v2 import RQMLIntelligenceLoop
 from origin.security.rbac import AccessController

@dataclass
class OriginTaskRequest:
 tenant_id: str
 task_id: str
 user_id: Optional[str]
 prompt: str
 metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class OriginTaskResult:
 task_id: str
 tenant_id: str
 user_id: Optional[str]
 final_output: Dict[str, Any]
 metadata: Dict[str, Any]

class OriginPipeline:
 """
 High level integration point that wires:

 - Scheduler
 - Worker
 - RQML Intelligence Loop
 - Security and RBAC
 """

 def __init__(
 self,
 scheduler: "Scheduler",
 worker: "Worker",
 rqml_loop: "RQMLIntelligenceLoop",
 rbac: "AccessController",
 ):
 self.scheduler = scheduler
 self.worker = worker
 self.rqml_loop = rqml_loop
 self.rbac = rbac

 def _check_access(self, request: OriginTaskRequest) -> None:
 allowed = self.rbac.can_execute_task(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_metadata=request.metadata,
 )
 if not allowed:
 raise PermissionError(
 f"User {request.user_id} is not allowed to execute task {request.task_id}"
 )

 def execute(self, request: OriginTaskRequest) -> OriginTaskResult:
 self._check_access(request)

 # Scheduler integration: enqueue or obtain execution slot
 slot = self.scheduler.reserve_slot(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_id=request.task_id,
 metadata=request.metadata,
 )

 try:
 base_context: Dict[str, Any] = {
 "scheduler": {"slot_id": slot.slot_id},
 "metadata": dict(request.metadata),
 }

 # Worker may add additional context (for example trace ids)
 worker_context = self.worker.prepare_context(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 context=base_context,
 )

 rqml_result = self.rqml_loop.run(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 prompt=request.prompt,
 context=worker_context,
 )

 final_payload = self.worker.finalize_result(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 rqml_result=rqml_result,
 )

 return OriginTaskResult(
 task_id=request.task_id,
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 final_output=final_payload,
 metadata={
 "scheduler_slot": slot.to_dict(),
 "rqml_iterations": rqml_result["context"]
 .get("rqml", {})
 .get("last_consensus_score"),
 },
 )
 finally:
 self.scheduler.release_slot(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_id=request.task_id,
 slot_id=slot.slot_id,
 )

These modules extend the supervision, routing, ensemble, and RQML loop and tie them into the worker, scheduler, ONE repository, metrics, and RBAC surfaces. They assume your existing interfaces and can be wired by constructing:

`AdvancedSupervisionEngine` around the current supervision engine and classifier

`PolicyDrivenRouterAdapter` around the existing router

`EnhancedEnsembleValidator` around the existing ensemble validator

`RQMLIntelligenceLoop` around the router adapter, validator, supervision, ONE, and metrics

`OriginPipeline` around scheduler, worker, RQML loop, and RBAC

No existing modules are modified.

## User

Proceed

## ChatGPT

python

Copy code

# origin/security/rbac.py

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional, Set

class Role(Enum):
 SYSTEM = "system"
 ADMIN = "admin"
 OPERATOR = "operator"
 STANDARD = "standard"
 READ_ONLY = "read_only"

@dataclass
class Principal:
 user_id: Optional[str]
 roles: Set[Role]
 tenant_id: str

class AccessController:
 """
 Simple RBAC facade used by OriginPipeline and admin APIs.

 In a real deployment this would delegate to the identity provider / IAM system.
 """

 def __init__(self) -> None:
 self._principals: Dict[str, Principal] = {}

 def register_principal(self, principal: Principal) -> None:
 if principal.user_id:
 self._principals[principal.user_id] = principal

 def _get_principal(
 self, tenant_id: str, user_id: Optional[str]
 ) -> Optional[Principal]:
 if user_id and user_id in self._principals:
 p = self._principals[user_id]
 if p.tenant_id == tenant_id:
 return p
 return None

 def has_role(
 self, tenant_id: str, user_id: Optional[str], role: Role
 ) -> bool:
 principal = self._get_principal(tenant_id, user_id)
 if not principal:
 return False
 return role in principal.roles

 def can_execute_task(
 self,
 tenant_id: str,
 user_id: Optional[str],
 task_metadata: Dict[str, Any],
 ) -> bool:
 """
 Basic rule set:
 - SYSTEM, ADMIN, OPERATOR: always allowed
 - STANDARD: allowed by default
 - READ_ONLY: blocked for mutating tasks
 """
 principal = self._get_principal(tenant_id, user_id)
 if not principal:
 return False

 if Role.SYSTEM in principal.roles:
 return True
 if Role.ADMIN in principal.roles:
 return True
 if Role.OPERATOR in principal.roles:
 return True

 is_read_only = task_metadata.get("read_only", False)
 if Role.READ_ONLY in principal.roles and not is_read_only:
 return False

 return True

python

Copy code

# origin/scheduler/core.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional
import time
import uuid

@dataclass
class SchedulerSlot:
 slot_id: str
 tenant_id: str
 user_id: Optional[str]
 task_id: str
 acquired_at: float
 metadata: Dict[str, Any]

 def to_dict(self) -> Dict[str, Any]:
 return {
 "slot_id": self.slot_id,
 "tenant_id": self.tenant_id,
 "user_id": self.user_id,
 "task_id": self.task_id,
 "acquired_at": self.acquired_at,
 "metadata": self.metadata,
 }

class Scheduler:
 """
 Minimal scheduler interface.

 In production this can be backed by Redis, Postgres, or a dedicated job system.
 """

 def __init__(self, max_concurrent_per_tenant: int = 16) -> None:
 self.max_concurrent_per_tenant = max_concurrent_per_tenant
 self._active_by_tenant: Dict[str, int] = {}

 def reserve_slot(
 self,
 tenant_id: str,
 user_id: Optional[str],
 task_id: str,
 metadata: Dict[str, Any],
 ) -> SchedulerSlot:
 active = self._active_by_tenant.get(tenant_id, 0)
 if active >= self.max_concurrent_per_tenant:
 raise RuntimeError(
 f"Tenant {tenant_id} exceeded concurrent limit "
 f"({self.max_concurrent_per_tenant})"
 )

 self._active_by_tenant[tenant_id] = active + 1
 slot = SchedulerSlot(
 slot_id=str(uuid.uuid4()),
 tenant_id=tenant_id,
 user_id=user_id,
 task_id=task_id,
 acquired_at=time.time(),
 metadata=dict(metadata),
 )
 return slot

 def release_slot(
 self,
 tenant_id: str,
 user_id: Optional[str],
 task_id: str,
 slot_id: str,
 ) -> None:
 active = self._active_by_tenant.get(tenant_id, 0)
 if active <= 1:
 self._active_by_tenant[tenant_id] = 0
 else:
 self._active_by_tenant[tenant_id] = active - 1

python

Copy code

# origin/worker/core.py

from __future__ import annotations

from typing import Any, Dict, Optional

class Worker:
 """
 Worker integration surface.

 This is where tracing, logging, and environment specific decorations can be added.
 """

 def __init__(self, worker_id: str) -> None:
 self.worker_id = worker_id

 def prepare_context(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 ctx = dict(context)
 ctx.setdefault("worker", {})
 ctx["worker"]["worker_id"] = self.worker_id
 return ctx

 def finalize_result(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 rqml_result: Dict[str, Any],
 ) -> Dict[str, Any]:
 """
 Standardizes the final payload.

 rqml_result is the output of RQMLIntelligenceLoop.run
 """
 outputs = rqml_result.get("outputs", [])
 validated = rqml_result.get("validated", {})
 context = rqml_result.get("context", {})

 # Default behavior: select top ranked output if available
 chosen = None
 if outputs:
 chosen = outputs[0]

 return {
 "task_id": task_id,
 "tenant_id": tenant_id,
 "user_id": user_id,
 "chosen": chosen,
 "all_outputs": outputs,
 "validated": validated,
 "context": context,
 }

python

Copy code

# origin/one/repository.py

from __future__ import annotations

from typing import Any, Dict

class ONERepository:
 """
 High level interface to ONE, the consolidated, bias filtered, validated knowledge store.

 Here we only implement the reinforcement hook used by the RQML loop.
 """

 def __init__(self) -> None:
 self._storage = {}

 def reinforce_from_rqml_cycle(
 self,
 tenant_id: str,
 task_id: str,
 cycle: Dict[str, Any],
 ) -> None:
 """
 Stores a compressed representation of an RQML cycle keyed by tenant and task.

 In a production system this would:
 - Extract ontology aligned entities and relations
 - Update ONE objects via a graph or vector store
 - Maintain provenance and bias scores
 """
 key = (tenant_id, task_id)
 self._storage[key] = cycle

 def get_cycle(
 self,
 tenant_id: str,
 task_id: str,
 ) -> Dict[str, Any]:
 return self._storage.get((tenant_id, task_id), {})

python

Copy code

# origin/metrics/client.py

from __future__ import annotations

from typing import Any, Dict, Optional

class MetricsClient:
 """
 Very thin abstraction over metrics.

 In deployment, this would be backed by Prometheus, StatsD, OpenTelemetry, etc.
 """

 def gauge(self, name: str, value: float, tags: Optional[Dict[str, Any]] = None) -> None:
 # Placeholder: integrate with real metrics in deployment
 _ = (name, value, tags)
 return

python

Copy code

# origin/config/safety_topics.py

from __future__ import annotations

from typing import Dict

from origin.supervision.modes import (
 EscalationLevel,
 SafetyMode,
 TopicRisk,
 TopicSensitivityRule,
)

def default_topic_rules() -> Dict[str, TopicSensitivityRule]:
 """
 Default topic sensitivity taxonomy.

 Tags are produced by the TaskClassifier and consumed by AdvancedSupervisionEngine.
 """
 rules = {
 "general": TopicSensitivityRule(
 topic_tag="general",
 min_mode=SafetyMode.LOW,
 risk=TopicRisk.BENIGN,
 default_escalation=EscalationLevel.NONE,
 ),
 "politics": TopicSensitivityRule(
 topic_tag="politics",
 min_mode=SafetyMode.STANDARD,
 risk=TopicRisk.SENSITIVE,
 default_escalation=EscalationLevel.SOFT,
 ),
 "elections": TopicSensitivityRule(
 topic_tag="elections",
 min_mode=SafetyMode.STANDARD,
 risk=TopicRisk.SENSITIVE,
 default_escalation=EscalationLevel.SOFT,
 ),
 "weapons": TopicSensitivityRule(
 topic_tag="weapons",
 min_mode=SafetyMode.HIGH,
 risk=TopicRisk.HIGH_RISK,
 default_escalation=EscalationLevel.HARD,
 block_in_modes={SafetyMode.LOCKED_DOWN},
 require_human_in_modes={SafetyMode.HIGH, SafetyMode.LOCKED_DOWN},
 ),
 "bio_risk": TopicSensitivityRule(
 topic_tag="bio_risk",
 min_mode=SafetyMode.HIGH,
 risk=TopicRisk.CRITICAL,
 default_escalation=EscalationLevel.HARD,
 block_in_modes={SafetyMode.HIGH, SafetyMode.LOCKED_DOWN},
 require_human_in_modes={SafetyMode.HIGH, SafetyMode.LOCKED_DOWN},
 ),
 "security_critical": TopicSensitivityRule(
 topic_tag="security_critical",
 min_mode=SafetyMode.HIGH,
 risk=TopicRisk.CRITICAL,
 default_escalation=EscalationLevel.HUMAN,
 block_in_modes={SafetyMode.LOCKED_DOWN},
 require_human_in_modes={SafetyMode.HIGH, SafetyMode.LOCKED_DOWN},
 ),
 "medical": TopicSensitivityRule(
 topic_tag="medical",
 min_mode=SafetyMode.STANDARD,
 risk=TopicRisk.SENSITIVE,
 default_escalation=EscalationLevel.SOFT,
 ),
 "legal": TopicSensitivityRule(
 topic_tag="legal",
 min_mode=SafetyMode.STANDARD,
 risk=TopicRisk.SENSITIVE,
 default_escalation=EscalationLevel.SOFT,
 ),
 "finance": TopicSensitivityRule(
 topic_tag="finance",
 min_mode=SafetyMode.STANDARD,
 risk=TopicRisk.SENSITIVE,
 default_escalation=EscalationLevel.SOFT,
 ),
 }
 return rules

python

Copy code

# origin/models/safety_hooks.py

from __future__ import annotations

from typing import Any, Dict, Iterable

class ModelSafetyMixin:
 """
 Optional mixin for ModelProvider implementations to advertise safety hooks.

 Router and supervision layers can prefer providers that expose these.
 """

 safety_hooks: Iterable[str] = ()

 def safety_metadata(self) -> Dict[str, Any]:
 """
 Returns advertised safety capabilities, e.g.:

 - "red_team_filter"
 - "profanity_filter"
 - "self_censoring"
 - "policy_tuned"
 """
 return {"safety_hooks": list(self.safety_hooks)}

python

Copy code

# origin/api/admin_supervision.py

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from origin.security.rbac import AccessController, Role
from origin.supervision.engine_v2 import AdvancedSupervisionEngine
from origin.supervision.modes import SafetyMode, TopicSensitivityRule
from origin.config.safety_topics import default_topic_rules

def get_rbac() -> AccessController:
 # to be wired by DI container
 raise NotImplementedError

def get_supervision() -> AdvancedSupervisionEngine:
 # to be wired by DI container
 raise NotImplementedError

admin_router = APIRouter(prefix="/admin/supervision", tags=["admin.supervision"])

def _require_admin(
 tenant_id: str,
 user_id: str,
 rbac: AccessController,
) -> None:
 if not rbac.has_role(tenant_id=tenant_id, user_id=user_id, role=Role.ADMIN):
 raise HTTPException(status_code=403, detail="Admin role required")

@admin_router.post("/mode/{tenant_id}")
def set_tenant_mode(
 tenant_id: str,
 body: Dict[str, Any],
 user_id: str,
 rbac: AccessController = Depends(get_rbac),
 supervision: AdvancedSupervisionEngine = Depends(get_supervision),
) -> Dict[str, Any]:
 _require_admin(tenant_id=tenant_id, user_id=user_id, rbac=rbac)

 mode_str = body.get("mode")
 if mode_str not in SafetyMode._value2member_map_:
 raise HTTPException(status_code=400, detail="Invalid safety mode")

 mode = SafetyMode(mode_str)
 supervision.set_tenant_mode(tenant_id, mode)
 return {"tenant_id": tenant_id, "mode": mode.value}

@admin_router.post("/topics/reset")
def reset_topic_rules(
 user_id: str,
 tenant_id: str,
 rbac: AccessController = Depends(get_rbac),
 supervision: AdvancedSupervisionEngine = Depends(get_supervision),
) -> Dict[str, Any]:
 _require_admin(tenant_id=tenant_id, user_id=user_id, rbac=rbac)
 rules = default_topic_rules()
 for rule in rules.values():
 supervision.update_topic_rule(rule)
 return {"status": "ok", "rules": list(rules.keys())}

@admin_router.post("/topics")
def upsert_topic_rule(
 tenant_id: str,
 body: Dict[str, Any],
 user_id: str,
 rbac: AccessController = Depends(get_rbac),
 supervision: AdvancedSupervisionEngine = Depends(get_supervision),
) -> Dict[str, Any]:
 _require_admin(tenant_id=tenant_id, user_id=user_id, rbac=rbac)

 try:
 rule = TopicSensitivityRule(
 topic_tag=body["topic_tag"],
 min_mode=SafetyMode(body.get("min_mode", SafetyMode.STANDARD.value)),
 risk=body.get("risk"), # expects TopicRisk or handled externally
 default_escalation=body.get("default_escalation"),
 block_in_modes=set(
 SafetyMode(m) for m in body.get("block_in_modes", [])
 ),
 require_human_in_modes=set(
 SafetyMode(m) for m in body.get("require_human_in_modes", [])
 ),
 )
 except Exception:
 raise HTTPException(status_code=400, detail="Invalid topic rule payload")

 supervision.update_topic_rule(rule)
 return {"status": "ok", "topic_tag": rule.topic_tag}

python

Copy code

# origin/deploy/container.py

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI

from origin.scheduler.core import Scheduler
from origin.worker.core import Worker
from origin.security.rbac import AccessController
from origin.metrics.client import MetricsClient
from origin.one.repository import ONERepository
from origin.supervision.engine import SupervisionEngine # existing
from origin.supervision.engine_v2 import AdvancedSupervisionEngine, SupervisionConfig
from origin.config.safety_topics import default_topic_rules
from origin.classification import TaskClassifier # existing
from origin.routing.router import ModelRouter # existing
from origin.routing.policy_tree import (
 PolicyDrivenRouterAdapter,
 build_default_policy_tree,
)
from origin.ensemble.validator import EnsembleValidator # existing
from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
from origin.rqml.loop_v2 import RQMLIntelligenceLoop, RQMLLoopConfig
from origin.integration.origin_pipeline import OriginPipeline
from origin.api.admin_supervision import admin_router, get_rbac, get_supervision
from origin.models.provider import ModelProvider # existing

class Container:
 """
 Simple composition root for Aureon XI Origin deployment.
 """

 def __init__(self) -> None:
 self.scheduler = Scheduler()
 self.worker = Worker(worker_id="origin-worker-1")
 self.rbac = AccessController()
 self.metrics = MetricsClient()
 self.one_repo = ONERepository()

 # Existing components
 self.base_supervision = SupervisionEngine()
 self.classifier = TaskClassifier()
 self.base_router = ModelRouter()
 self.base_validator = EnsembleValidator()

 # Model providers (registered elsewhere)
 self.providers_by_id: Dict[str, ModelProvider] = {}

 # Advanced supervision
 sup_config = SupervisionConfig()
 sup_config.topic_rules = default_topic_rules()
 self.advanced_supervision = AdvancedSupervisionEngine(
 base_engine=self.base_supervision,
 classifier=self.classifier,
 config=sup_config,
 )

 # Routing policy tree
 policy_tree = build_default_policy_tree()
 self.policy_router = PolicyDrivenRouterAdapter(
 router=self.base_router,
 supervision=self.advanced_supervision,
 policy_tree=policy_tree,
 providers_by_id=self.providers_by_id,
 )

 # Enhanced ensemble validator
 self.enhanced_validator = EnhancedEnsembleValidator(self.base_validator)

 # RQML loop
 loop_config = RQMLLoopConfig()
 self.rqml_loop = RQMLIntelligenceLoop(
 router=self.policy_router,
 validator=self.enhanced_validator,
 supervision=self.advanced_supervision,
 one_repo=self.one_repo,
 metrics=self.metrics,
 config=loop_config,
 )

 # Origin pipeline
 self.pipeline = OriginPipeline(
 scheduler=self.scheduler,
 worker=self.worker,
 rqml_loop=self.rqml_loop,
 rbac=self.rbac,
 )

 # FastAPI wiring
 self.app = FastAPI()
 self._wire_dependencies()
 self._register_routes()

 def _wire_dependencies(self) -> None:
 # Patch admin_supervision dependency getters
 import origin.api.admin_supervision as admin

 def _rbac() -> AccessController:
 return self.rbac

 def _sup() -> AdvancedSupervisionEngine:
 return self.advanced_supervision

 admin.get_rbac = _rbac # type: ignore[assignment]
 admin.get_supervision = _sup # type: ignore[assignment]

 def _register_routes(self) -> None:
 self.app.include_router(admin_router)

 @self.app.post("/origin/execute")
 async def execute_task(payload: Dict[str, str]) -> Dict[str, any]:
 from origin.integration.origin_pipeline import OriginTaskRequest

 req = OriginTaskRequest(
 tenant_id=payload["tenant_id"],
 task_id=payload["task_id"],
 user_id=payload.get("user_id"),
 prompt=payload["prompt"],
 metadata=payload.get("metadata", {}),
 )
 result = self.pipeline.execute(req)
 return {
 "task_id": result.task_id,
 "tenant_id": result.tenant_id,
 "user_id": result.user_id,
 "final_output": result.final_output,
 "metadata": result.metadata,
 }

def build_app() -> FastAPI:
 container = Container()
 return container.app

This continues Session #004 by wiring the advanced supervision, routing, ensemble, and RQML loop into a deployable Origin pipeline with RBAC, scheduler, worker, ONE reinforcement, metrics, and admin adjustment surfaces.

## User

Proceed

## ChatGPT

python

Copy code

# origin/supervision/disagreement_bridge.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, TYPE_CHECKING

from .modes import SafetyMode, TopicRisk, SupervisionEvent, EscalationLevel

if TYPE_CHECKING:
 from origin.supervision.engine_v2 import AdvancedSupervisionEngine
 from origin.metrics.client import MetricsClient

@dataclass
class DisagreementSupervisionConfig:
 """
 Configures how strong cross-model disagreement feeds back into safety behavior.
 """
 # If consensus below this, mark as unstable
 unstable_consensus_threshold: float = 0.6
 # If pairwise disagreement above this, mark as contentious
 contentious_pairwise_threshold: float = 0.5
 # If both conditions are met, increase mode for this tenant
 raise_mode_to_high_on_contention: bool = True
 # If repeatedly contentious, lock tenant into HIGH or LOCKED_DOWN
 contentious_events_for_lockdown: int = 3

@dataclass
class TenantDisagreementState:
 unstable_events: int = 0
 contentious_events: int = 0

class DisagreementSupervisionBridge:
 """
 Connects ensemble disagreement metrics to supervision and metrics.

 This provides a feedback channel so that:
 - Highly contentious topics can push tenants into stricter modes.
 - Repeated instability can be surfaced to operators.
 """

 def __init__(
 self,
 supervision: "AdvancedSupervisionEngine",
 metrics: Optional["MetricsClient"],
 config: Optional[DisagreementSupervisionConfig] = None,
 ) -> None:
 self.supervision = supervision
 self.metrics = metrics
 self.config = config or DisagreementSupervisionConfig()
 self._tenant_state: Dict[str, TenantDisagreementState] = {}

 def _state_for(self, tenant_id: str) -> TenantDisagreementState:
 if tenant_id not in self._tenant_state:
 self._tenant_state[tenant_id] = TenantDisagreementState()
 return self._tenant_state[tenant_id]

 def _emit_metrics(
 self,
 tenant_id: str,
 task_id: str,
 consensus: float,
 pairwise: float,
 unstable: bool,
 contentious: bool,
 ) -> None:
 if not self.metrics:
 return
 try:
 self.metrics.gauge(
 "origin.rqml.disagreement.consensus",
 consensus,
 tags={"tenant": tenant_id, "task": task_id},
 )
 self.metrics.gauge(
 "origin.rqml.disagreement.pairwise",
 pairwise,
 tags={"tenant": tenant_id, "task": task_id},
 )
 self.metrics.gauge(
 "origin.rqml.disagreement.unstable_flag",
 float(unstable),
 tags={"tenant": tenant_id, "task": task_id},
 )
 self.metrics.gauge(
 "origin.rqml.disagreement.contentious_flag",
 float(contentious),
 tags={"tenant": tenant_id, "task": task_id},
 )
 except Exception:
 return

 def on_cycle_disagreement(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 topic_tags: Any,
 disagreement_meta: Dict[str, Any],
 ) -> None:
 """
 Entry point called by the integration pipeline after each RQML cycle.

 disagreement_meta is:
 {
 "pairwise": float,
 "max_pairwise": float,
 "consensus_score": float,
 ...
 }
 """
 consensus = float(disagreement_meta.get("consensus_score", 0.0))
 pairwise = float(disagreement_meta.get("pairwise", 0.0))

 unstable = consensus < self.config.unstable_consensus_threshold
 contentious = pairwise > self.config.contentious_pairwise_threshold

 self._emit_metrics(
 tenant_id=tenant_id,
 task_id=task_id,
 consensus=consensus,
 pairwise=pairwise,
 unstable=unstable,
 contentious=contentious,
 )

 state = self._state_for(tenant_id)

 if unstable:
 state.unstable_events += 1
 if contentious:
 state.contentious_events += 1

 # Optional: raise mode when a contentious pattern is detected
 if (
 self.config.raise_mode_to_high_on_contention
 and contentious
 ):
 current_mode = self.supervision.resolve_mode(tenant_id)
 if current_mode.value < SafetyMode.HIGH.value:
 self.supervision.set_tenant_mode(tenant_id, SafetyMode.HIGH)

 # Optional: lock tenant into strict modes if contention is persistent
 if (
 state.contentious_events >= self.config.contentious_events_for_lockdown
 ):
 current_mode = self.supervision.resolve_mode(tenant_id)
 if current_mode != SafetyMode.LOCKED_DOWN:
 self.supervision.set_tenant_mode(tenant_id, SafetyMode.LOCKED_DOWN)

 # Emit a synthetic supervision event for operators
 event = SupervisionEvent(
 task_id=task_id,
 user_id=user_id,
 mode=self.supervision.resolve_mode(tenant_id),
 topic_tags=list(topic_tags or []),
 risk=TopicRisk.SENSITIVE,
 escalation_level=EscalationLevel.SOFT,
 message="Disagreement-based supervision feedback",
 blocked=False,
 metadata={
 "consensus_score": consensus,
 "pairwise_disagreement": pairwise,
 "unstable": unstable,
 "contentious": contentious,
 },
 )
 self.supervision._emit_event(event)

python

Copy code

# origin/integration/disagreement_monitor.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
 from origin.supervision.disagreement_bridge import DisagreementSupervisionBridge

@dataclass
class DisagreementMonitor:
 """
 Light integration wrapper that inspects RQML results and informs the supervision bridge.
 """
 bridge: "DisagreementSupervisionBridge"

 def inspect_rqml_result(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 rqml_result: Dict[str, Any],
 ) -> None:
 ctx = rqml_result.get("context", {})
 rqml_meta = ctx.get("rqml", {})
 ensemble_meta = rqml_result.get("validated", {}).get("ensemble", {})
 disagreement_meta = ensemble_meta.get("disagreement", {})

 topic_tags = ctx.get("supervision", {}).get("topic_tags") or rqml_meta.get(
 "topic_tags"
 )

 self.bridge.on_cycle_disagreement(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 topic_tags=topic_tags,
 disagreement_meta=disagreement_meta,
 )

python

Copy code

# origin/integration/origin_pipeline_v2.py

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional, TYPE_CHECKING

from .origin_pipeline import OriginTaskRequest, OriginTaskResult

if TYPE_CHECKING:
 from origin.scheduler.core import Scheduler
 from origin.worker.core import Worker
 from origin.rqml.loop_v2 import RQMLIntelligenceLoop
 from origin.security.rbac import AccessController
 from origin.integration.disagreement_monitor import DisagreementMonitor

@dataclass
class OriginPipelineV2:
 """
 Extended pipeline that includes disagreement monitoring after the RQML loop.
 """
 scheduler: "Scheduler"
 worker: "Worker"
 rqml_loop: "RQMLIntelligenceLoop"
 rbac: "AccessController"
 disagreement_monitor: "DisagreementMonitor"

 def _check_access(self, request: OriginTaskRequest) -> None:
 allowed = self.rbac.can_execute_task(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_metadata=request.metadata,
 )
 if not allowed:
 raise PermissionError(
 f"User {request.user_id} is not allowed to execute task {request.task_id}"
 )

 def execute(self, request: OriginTaskRequest) -> OriginTaskResult:
 self._check_access(request)

 slot = self.scheduler.reserve_slot(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_id=request.task_id,
 metadata=request.metadata,
 )

 try:
 base_context: Dict[str, Any] = {
 "scheduler": {"slot_id": slot.slot_id},
 "metadata": dict(request.metadata),
 }

 worker_context = self.worker.prepare_context(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 context=base_context,
 )

 rqml_result = self.rqml_loop.run(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 prompt=request.prompt,
 context=worker_context,
 )

 # Feed disagreement metrics back into supervision system
 self.disagreement_monitor.inspect_rqml_result(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 rqml_result=rqml_result,
 )

 final_payload = self.worker.finalize_result(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 rqml_result=rqml_result,
 )

 return OriginTaskResult(
 task_id=request.task_id,
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 final_output=final_payload,
 metadata={
 "scheduler_slot": slot.to_dict(),
 "rqml_consensus_score": rqml_result["context"]
 .get("rqml", {})
 .get("last_consensus_score"),
 "rqml_pairwise_disagreement": rqml_result["context"]
 .get("rqml", {})
 .get("last_pairwise_disagreement"),
 },
 )
 finally:
 self.scheduler.release_slot(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_id=request.task_id,
 slot_id=slot.slot_id,
 )

python

Copy code

# origin/deploy/container_v2.py

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI

from origin.scheduler.core import Scheduler
from origin.worker.core import Worker
from origin.security.rbac import AccessController
from origin.metrics.client import MetricsClient
from origin.one.repository import ONERepository
from origin.supervision.engine import SupervisionEngine # existing
from origin.supervision.engine_v2 import AdvancedSupervisionEngine, SupervisionConfig
from origin.supervision.disagreement_bridge import (
 DisagreementSupervisionBridge,
 DisagreementSupervisionConfig,
)
from origin.config.safety_topics import default_topic_rules
from origin.classification import TaskClassifier # existing
from origin.routing.router import ModelRouter # existing
from origin.routing.policy_tree import (
 PolicyDrivenRouterAdapter,
 build_default_policy_tree,
)
from origin.ensemble.validator import EnsembleValidator # existing
from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
from origin.rqml.loop_v2 import RQMLIntelligenceLoop, RQMLLoopConfig
from origin.integration.disagreement_monitor import DisagreementMonitor
from origin.integration.origin_pipeline_v2 import OriginPipelineV2, OriginTaskRequest
from origin.api.admin_supervision import admin_router, get_rbac, get_supervision
from origin.models.provider import ModelProvider # existing

class ContainerV2:
 """
 Extended composition root that includes disagreement-aware supervision feedback.
 """

 def __init__(self) -> None:
 self.scheduler = Scheduler()
 self.worker = Worker(worker_id="origin-worker-1")
 self.rbac = AccessController()
 self.metrics = MetricsClient()
 self.one_repo = ONERepository()

 # Existing base components
 self.base_supervision = SupervisionEngine()
 self.classifier = TaskClassifier()
 self.base_router = ModelRouter()
 self.base_validator = EnsembleValidator()

 self.providers_by_id: Dict[str, ModelProvider] = {}

 # Advanced supervision config
 sup_config = SupervisionConfig()
 sup_config.topic_rules = default_topic_rules()
 self.advanced_supervision = AdvancedSupervisionEngine(
 base_engine=self.base_supervision,
 classifier=self.classifier,
 config=sup_config,
 )

 # Disagreement bridge
 disagreement_config = DisagreementSupervisionConfig()
 self.disagreement_bridge = DisagreementSupervisionBridge(
 supervision=self.advanced_supervision,
 metrics=self.metrics,
 config=disagreement_config,
 )

 # Routing policy tree
 policy_tree = build_default_policy_tree()
 self.policy_router = PolicyDrivenRouterAdapter(
 router=self.base_router,
 supervision=self.advanced_supervision,
 policy_tree=policy_tree,
 providers_by_id=self.providers_by_id,
 )

 # Enhanced validator
 self.enhanced_validator = EnhancedEnsembleValidator(self.base_validator)

 # RQML loop
 loop_config = RQMLLoopConfig()
 self.rqml_loop = RQMLIntelligenceLoop(
 router=self.policy_router,
 validator=self.enhanced_validator,
 supervision=self.advanced_supervision,
 one_repo=self.one_repo,
 metrics=self.metrics,
 config=loop_config,
 )

 # Disagreement monitor
 self.disagreement_monitor = DisagreementMonitor(self.disagreement_bridge)

 # Origin pipeline v2
 self.pipeline = OriginPipelineV2(
 scheduler=self.scheduler,
 worker=self.worker,
 rqml_loop=self.rqml_loop,
 rbac=self.rbac,
 disagreement_monitor=self.disagreement_monitor,
 )

 self.app = FastAPI()
 self._wire_dependencies()
 self._register_routes()

 def _wire_dependencies(self) -> None:
 # Patch admin_supervision dependency getters
 import origin.api.admin_supervision as admin

 def _rbac() -> AccessController:
 return self.rbac

 def _sup() -> AdvancedSupervisionEngine:
 return self.advanced_supervision

 admin.get_rbac = _rbac # type: ignore[assignment]
 admin.get_supervision = _sup # type: ignore[assignment]

 def _register_routes(self) -> None:
 self.app.include_router(admin_router)

 @self.app.post("/origin/execute")
 async def execute_task(payload: Dict[str, any]) -> Dict[str, any]:
 req = OriginTaskRequest(
 tenant_id=payload["tenant_id"],
 task_id=payload["task_id"],
 user_id=payload.get("user_id"),
 prompt=payload["prompt"],
 metadata=payload.get("metadata", {}),
 )
 result = self.pipeline.execute(req)
 return {
 "task_id": result.task_id,
 "tenant_id": result.tenant_id,
 "user_id": result.user_id,
 "final_output": result.final_output,
 "metadata": result.metadata,
 }

def build_app_v2() -> FastAPI:
 container = ContainerV2()
 return container.app

This extends ORIGIN Session #004 with disagreement-aware supervision feedback, a monitor that bridges RQML ensemble metrics back into safety modes, and a V2 deployment container that wires everything into a FastAPI app without rewriting existing modules.

## User

Proceed

## ChatGPT

python

Copy code

# origin/supervision/event_store.py

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Deque, Dict, Iterable, List, Optional, Tuple
from collections import deque

from .modes import SupervisionEvent

@dataclass
class StoredEvent:
 """
 Thin wrapper around SupervisionEvent with an auto-incrementing id.
 """
 id: int
 event: SupervisionEvent

 def to_dict(self) -> Dict[str, Any]:
 d = asdict(self.event)
 d["id"] = self.id
 return d

class SupervisionEventStore:
 """
 In-memory event store for operator inspection and debugging.

 This is an integration surface for:
 - Operator consoles
 - Admin APIs
 - Offline analysis
 """

 def __init__(self, max_events: int = 10_000) -> None:
 self.max_events = max_events
 self._events: Deque[StoredEvent] = deque()
 self._next_id: int = 1

 def sink(self, event: SupervisionEvent) -> None:
 """
 Event sink compatible with AdvancedSupervisionEngine.register_event_sink.
 """
 if len(self._events) >= self.max_events:
 self._events.popleft()
 stored = StoredEvent(id=self._next_id, event=event)
 self._events.append(stored)
 self._next_id += 1

 def list_events(
 self,
 limit: int = 100,
 offset: int = 0,
 tenant_id: Optional[str] = None,
 user_id: Optional[str] = None,
 mode: Optional[str] = None,
 escalation_level: Optional[str] = None,
 ) -> List[Dict[str, Any]]:
 events: List[StoredEvent] = list(self._events)
 filtered: List[StoredEvent] = []

 for se in reversed(events): # newest first
 e = se.event
 if user_id is not None and e.user_id != user_id:
 continue
 if mode is not None and e.mode.value != mode:
 continue
 if escalation_level is not None and e.escalation_level.value != escalation_level:
 continue
 # tenant_id is expected to be present in metadata if needed
 if tenant_id is not None and e.metadata.get("tenant_id") != tenant_id:
 continue
 filtered.append(se)

 sliced = filtered[offset : offset + limit]
 return [s.to_dict() for s in sliced]

 def get_event(self, event_id: int) -> Optional[Dict[str, Any]]:
 for se in self._events:
 if se.id == event_id:
 return se.to_dict()
 return None

python

Copy code

# origin/routing/safety_policy_router.py

from __future__ import annotations

from typing import List, TYPE_CHECKING

from origin.routing.policy_tree import PolicyDrivenRouterAdapter, RoutingAction
from origin.models.safety_hooks import ModelSafetyMixin # optional mixin

if TYPE_CHECKING:
 from origin.routing.router import ModelRouter
 from origin.supervision.engine_v2 import AdvancedSupervisionEngine
 from origin.models.provider import ModelProvider
 from origin.routing.policy_tree import RoutingPolicyTree

class SafetyAwarePolicyRouter(PolicyDrivenRouterAdapter):
 """
 Extension of PolicyDrivenRouterAdapter that enforces required model safety hooks
 from SupervisionConfig.required_model_safety_hooks.
 """

 def __init__(
 self,
 router: "ModelRouter",
 supervision: "AdvancedSupervisionEngine",
 policy_tree: "RoutingPolicyTree",
 providers_by_id: dict[str, "ModelProvider"],
 ) -> None:
 super().__init__(
 router=router,
 supervision=supervision,
 policy_tree=policy_tree,
 providers_by_id=providers_by_id,
 )

 def _available_providers_for_action(
 self, action: RoutingAction
 ) -> List["ModelProvider"]:
 candidates = super()._available_providers_for_action(action)
 required = self.supervision.config.required_model_safety_hooks

 if not required:
 return candidates

 required_set = set(required)
 strict_candidates: List["ModelProvider"] = []
 for p in candidates:
 hooks = set(getattr(p, "safety_hooks", set()) or set())
 if required_set.issubset(hooks):
 strict_candidates.append(p)

 # If we have at least one provider that meets required hooks, use only those.
 if strict_candidates:
 return strict_candidates

 # Fall back to original candidates if none satisfy strict requirement.
 return candidates

python

Copy code

# origin/rqml/prompt_refiner.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
 from origin.routing.policy_tree import PolicyDrivenRouterAdapter
 from origin.one.repository import ONERepository

@dataclass
class PromptRefinerConfig:
 """
 Configuration for RQML prompt refinement.
 """
 enable_ontology_hints: bool = True
 ontology_hint_key: str = "ontology_hints"
 refinement_provider_id: str = "planner_llm"
 max_hint_tokens: int = 256

class PromptRefiner:
 """
 Uses a dedicated provider (for example, a planning or editing model)
 and ONE ontology hints to iteratively improve prompts before they
 enter the main RQML loop.
 """

 def __init__(
 self,
 router: "PolicyDrivenRouterAdapter",
 one_repo: "ONERepository",
 config: Optional[PromptRefinerConfig] = None,
 ) -> None:
 self.router = router
 self.one_repo = one_repo
 self.config = config or PromptRefinerConfig()

 def _ontology_hint_for(
 self,
 tenant_id: str,
 task_id: str,
 ) -> str:
 if not self.config.enable_ontology_hints:
 return ""
 cycle = self.one_repo.get_cycle(tenant_id=tenant_id, task_id=task_id)
 hints = cycle.get(self.config.ontology_hint_key, "")
 if not isinstance(hints, str):
 return ""
 tokens = hints.split()
 if len(tokens) > self.config.max_hint_tokens:
 tokens = tokens[: self.config.max_hint_tokens]
 return " ".join(tokens)

 def refine(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 context: Dict[str, Any],
 ) -> str:
 """
 Returns a refined prompt.

 If refinement fails, the original prompt is returned.
 """
 ontology_hint = self._ontology_hint_for(tenant_id, task_id)
 refinement_prompt = (
 "You are an expert planner. Rewrite the user prompt so that it is:\n"
 "- unambiguous\n"
 "- decomposed into explicit objectives\n"
 "- aligned with the provided ontology hints (if any)\n\n"
 f"Ontology hints:\n{ontology_hint or '(none)'}\n\n"
 f"Original prompt:\n{prompt}\n\n"
 "Refined prompt:"
 )

 try:
 routed = self.router.route_and_infer(
 tenant_id=tenant_id,
 task_id=f"{task_id}#refine",
 user_id=user_id,
 prompt=refinement_prompt,
 context=context,
 )
 except Exception:
 return prompt

 outputs = routed.get("model_outputs", [])
 if not outputs:
 return prompt

 text = outputs[0].get("text") or ""
 return text or prompt

python

Copy code

# origin/rqml/orchestrator.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
 from origin.rqml.prompt_refiner import PromptRefiner
 from origin.rqml.loop_v2 import RQMLIntelligenceLoop
 from origin.supervision.engine_v2 import AdvancedSupervisionEngine

@dataclass
class RQMLOrchestrator:
 """
 High level orchestrator that:
 1. Refines the prompt using ontology-aware refinement.
 2. Runs the RQML intelligence loop.
 3. Returns the final RQML result.
 """
 refiner: "PromptRefiner"
 loop: "RQMLIntelligenceLoop"
 supervision: "AdvancedSupervisionEngine"

 def execute(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 refined_prompt = self.refiner.refine(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=context,
 )

 # Optionally annotate context with refinement metadata
 context.setdefault("rqml", {})
 context["rqml"]["refined_prompt"] = refined_prompt

 result = self.loop.run(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=refined_prompt,
 context=context,
 )
 return result

python

Copy code

# origin/integration/origin_pipeline_v3.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, TYPE_CHECKING

from origin.integration.origin_pipeline import OriginTaskRequest, OriginTaskResult

if TYPE_CHECKING:
 from origin.scheduler.core import Scheduler
 from origin.worker.core import Worker
 from origin.security.rbac import AccessController
 from origin.integration.disagreement_monitor import DisagreementMonitor
 from origin.rqml.orchestrator import RQMLOrchestrator

@dataclass
class OriginPipelineV3:
 """
 Pipeline that uses:
 - RBAC
 - Scheduler / Worker
 - RQMLOrchestrator (refinement + loop)
 - Disagreement monitor
 """
 scheduler: "Scheduler"
 worker: "Worker"
 rbac: "AccessController"
 orchestrator: "RQMLOrchestrator"
 disagreement_monitor: "DisagreementMonitor"

 def _check_access(self, request: OriginTaskRequest) -> None:
 allowed = self.rbac.can_execute_task(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_metadata=request.metadata,
 )
 if not allowed:
 raise PermissionError(
 f"User {request.user_id} is not allowed to execute task {request.task_id}"
 )

 def execute(self, request: OriginTaskRequest) -> OriginTaskResult:
 self._check_access(request)

 slot = self.scheduler.reserve_slot(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_id=request.task_id,
 metadata=request.metadata,
 )

 try:
 base_context: Dict[str, Any] = {
 "scheduler": {"slot_id": slot.slot_id},
 "metadata": dict(request.metadata),
 }

 worker_context = self.worker.prepare_context(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 context=base_context,
 )

 rqml_result = self.orchestrator.execute(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 prompt=request.prompt,
 context=worker_context,
 )

 self.disagreement_monitor.inspect_rqml_result(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 rqml_result=rqml_result,
 )

 final_payload = self.worker.finalize_result(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 rqml_result=rqml_result,
 )

 return OriginTaskResult(
 task_id=request.task_id,
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 final_output=final_payload,
 metadata={
 "scheduler_slot": slot.to_dict(),
 "rqml_consensus_score": rqml_result["context"]
 .get("rqml", {})
 .get("last_consensus_score"),
 "rqml_pairwise_disagreement": rqml_result["context"]
 .get("rqml", {})
 .get("last_pairwise_disagreement"),
 "refined_prompt": rqml_result["context"]
 .get("rqml", {})
 .get("refined_prompt"),
 },
 )
 finally:
 self.scheduler.release_slot(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_id=request.task_id,
 slot_id=slot.slot_id,
 )

python

Copy code

# origin/api/supervision_events.py

from __future__ import annotations

from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query

from origin.security.rbac import AccessController, Role
from origin.supervision.event_store import SupervisionEventStore

def get_rbac() -> AccessController:
 raise NotImplementedError

def get_event_store() -> SupervisionEventStore:
 raise NotImplementedError

events_router = APIRouter(prefix="/admin/supervision/events", tags=["admin.supervision.events"])

def _require_operator(
 tenant_id: str,
 user_id: str,
 rbac: AccessController,
) -> None:
 if not (
 rbac.has_role(tenant_id=tenant_id, user_id=user_id, role=Role.ADMIN)
 or rbac.has_role(tenant_id=tenant_id, user_id=user_id, role=Role.OPERATOR)
 ):
 raise HTTPException(status_code=403, detail="Operator or admin role required")

@events_router.get("/{tenant_id}")
def list_events(
 tenant_id: str,
 user_id: str,
 limit: int = Query(100, ge=1, le=1000),
 offset: int = Query(0, ge=0),
 mode: Optional[str] = None,
 escalation_level: Optional[str] = None,
 rbac: AccessController = Depends(get_rbac),
 store: SupervisionEventStore = Depends(get_event_store),
) -> Dict[str, Any]:
 _require_operator(tenant_id=tenant_id, user_id=user_id, rbac=rbac)

 items = store.list_events(
 limit=limit,
 offset=offset,
 tenant_id=tenant_id,
 user_id=None,
 mode=mode,
 escalation_level=escalation_level,
 )
 return {"items": items, "count": len(items)}

@events_router.get("/detail/{event_id}")
def get_event(
 event_id: int,
 user_id: str,
 tenant_id: str,
 rbac: AccessController = Depends(get_rbac),
 store: SupervisionEventStore = Depends(get_event_store),
) -> Dict[str, Any]:
 _require_operator(tenant_id=tenant_id, user_id=user_id, rbac=rbac)

 ev = store.get_event(event_id)
 if not ev:
 raise HTTPException(status_code=404, detail="Event not found")
 return ev

python

Copy code

# origin/deploy/container_v3.py

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI

from origin.scheduler.core import Scheduler
from origin.worker.core import Worker
from origin.security.rbac import AccessController
from origin.metrics.client import MetricsClient
from origin.one.repository import ONERepository
from origin.supervision.engine import SupervisionEngine # existing
from origin.supervision.engine_v2 import AdvancedSupervisionEngine, SupervisionConfig
from origin.supervision.event_store import SupervisionEventStore
from origin.supervision.disagreement_bridge import (
 DisagreementSupervisionBridge,
 DisagreementSupervisionConfig,
)
from origin.config.safety_topics import default_topic_rules
from origin.classification import TaskClassifier # existing
from origin.routing.router import ModelRouter # existing
from origin.routing.policy_tree import build_default_policy_tree
from origin.routing.safety_policy_router import SafetyAwarePolicyRouter
from origin.ensemble.validator import EnsembleValidator # existing
from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
from origin.rqml.loop_v2 import RQMLIntelligenceLoop, RQMLLoopConfig
from origin.rqml.prompt_refiner import PromptRefiner, PromptRefinerConfig
from origin.rqml.orchestrator import RQMLOrchestrator
from origin.integration.disagreement_monitor import DisagreementMonitor
from origin.integration.origin_pipeline_v3 import OriginPipelineV3, OriginTaskRequest
from origin.api.admin_supervision import admin_router, get_rbac, get_supervision
from origin.api.supervision_events import events_router, get_event_store
from origin.models.provider import ModelProvider # existing

class ContainerV3:
 """
 Composition root that wires:

 - Safety-aware policy routing
 - Advanced supervision + disagreement feedback
 - Ontology-aware prompt refinement
 - RQML loop and orchestrator
 - Supervision event store and operator APIs
 """

 def __init__(self) -> None:
 self.scheduler = Scheduler()
 self.worker = Worker(worker_id="origin-worker-1")
 self.rbac = AccessController()
 self.metrics = MetricsClient()
 self.one_repo = ONERepository()
 self.event_store = SupervisionEventStore()

 # Base components
 self.base_supervision = SupervisionEngine()
 self.classifier = TaskClassifier()
 self.base_router = ModelRouter()
 self.base_validator = EnsembleValidator()
 self.providers_by_id: Dict[str, ModelProvider] = {}

 # Advanced supervision config
 sup_config = SupervisionConfig()
 sup_config.topic_rules = default_topic_rules()
 sup_config.required_model_safety_hooks = {
 "policy_tuned",
 "self_censoring",
 }
 self.advanced_supervision = AdvancedSupervisionEngine(
 base_engine=self.base_supervision,
 classifier=self.classifier,
 config=sup_config,
 )
 # Register the event store sink
 self.advanced_supervision.register_event_sink(self.event_store.sink)

 # Disagreement bridge
 disagreement_config = DisagreementSupervisionConfig()
 self.disagreement_bridge = DisagreementSupervisionBridge(
 supervision=self.advanced_supervision,
 metrics=self.metrics,
 config=disagreement_config,
 )

 # Safety-aware policy router
 policy_tree = build_default_policy_tree()
 self.policy_router = SafetyAwarePolicyRouter(
 router=self.base_router,
 supervision=self.advanced_supervision,
 policy_tree=policy_tree,
 providers_by_id=self.providers_by_id,
 )

 # Enhanced ensemble validator
 self.enhanced_validator = EnhancedEnsembleValidator(self.base_validator)

 # RQML loop
 loop_config = RQMLLoopConfig()
 self.rqml_loop = RQMLIntelligenceLoop(
 router=self.policy_router,
 validator=self.enhanced_validator,
 supervision=self.advanced_supervision,
 one_repo=self.one_repo,
 metrics=self.metrics,
 config=loop_config,
 )

 # Prompt refiner
 refiner_config = PromptRefinerConfig()
 self.prompt_refiner = PromptRefiner(
 router=self.policy_router,
 one_repo=self.one_repo,
 config=refiner_config,
 )

 # Orchestrator
 self.orchestrator = RQMLOrchestrator(
 refiner=self.prompt_refiner,
 loop=self.rqml_loop,
 supervision=self.advanced_supervision,
 )

 # Disagreement monitor
 self.disagreement_monitor = DisagreementMonitor(self.disagreement_bridge)

 # Pipeline V3
 self.pipeline = OriginPipelineV3(
 scheduler=self.scheduler,
 worker=self.worker,
 rbac=self.rbac,
 orchestrator=self.orchestrator,
 disagreement_monitor=self.disagreement_monitor,
 )

 # API app
 self.app = FastAPI()
 self._wire_dependencies()
 self._register_routes()

 def _wire_dependencies(self) -> None:
 import origin.api.admin_supervision as admin
 import origin.api.supervision_events as events

 def _rbac() -> AccessController:
 return self.rbac

 def _sup() -> AdvancedSupervisionEngine:
 return self.advanced_supervision

 def _store() -> SupervisionEventStore:
 return self.event_store

 admin.get_rbac = _rbac # type: ignore[assignment]
 admin.get_supervision = _sup # type: ignore[assignment]
 events.get_rbac = _rbac # type: ignore[assignment]
 events.get_event_store = _store # type: ignore[assignment]

 def _register_routes(self) -> None:
 self.app.include_router(admin_router)
 self.app.include_router(events_router)

 @self.app.post("/origin/execute")
 async def execute_task(payload: Dict[str, any]) -> Dict[str, any]:
 req = OriginTaskRequest(
 tenant_id=payload["tenant_id"],
 task_id=payload["task_id"],
 user_id=payload.get("user_id"),
 prompt=payload["prompt"],
 metadata=payload.get("metadata", {}),
 )
 result = self.pipeline.execute(req)
 return {
 "task_id": result.task_id,
 "tenant_id": result.tenant_id,
 "user_id": result.user_id,
 "final_output": result.final_output,
 "metadata": result.metadata,
 }

def build_app_v3() -> FastAPI:
 container = ContainerV3()
 return container.app

## User

Proceed

## ChatGPT

python

Copy code

# origin/ensemble/strategies.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Sequence, Tuple

@dataclass
class EnsembleChoice:
 """
 Result of an ensemble selection strategy.

 chosen_index: index into `outputs` for the selected answer
 scores: model-level scores or weights used
 metadata: any additional diagnostic information
 """
 chosen_index: int
 scores: List[float]
 metadata: Dict[str, Any]

def _normalize_scores(raw: List[float]) -> List[float]:
 total = sum(raw) or 1.0
 return [x / total for x in raw]

def majority_vote_strategy(
 outputs: Sequence[Dict[str, Any]],
) -> EnsembleChoice:
 """
 Simple majority vote: group exact strings and pick the most common.

 If there is a tie, choose the first among tied answers.
 """
 if not outputs:
 raise ValueError("No outputs for majority_vote_strategy")

 texts = [o.get("text", "") for o in outputs]
 counts: Dict[str, int] = {}
 for t in texts:
 counts[t] = counts.get(t, 0) + 1

 best_text = max(counts.items(), key=lambda kv: kv[1])[0]
 chosen_index = texts.index(best_text)
 scores = _normalize_scores([counts[t] for t in texts])

 return EnsembleChoice(
 chosen_index=chosen_index,
 scores=scores,
 metadata={"votes": counts, "strategy": "majority_vote"},
 )

def strict_consensus_strategy(
 outputs: Sequence[Dict[str, Any]],
 allow_fallback: bool = True,
) -> EnsembleChoice:
 """
 Strict consensus: require that all *non-empty* answers match exactly.

 If there is no perfect consensus and allow_fallback is True,
 fall back to majority_vote_strategy.
 """
 if not outputs:
 raise ValueError("No outputs for strict_consensus_strategy")

 texts = [o.get("text", "") for o in outputs]
 non_empty = [t for t in texts if t.strip()]

 if not non_empty:
 # All empty; trivial "consensus"
 return EnsembleChoice(
 chosen_index=0,
 scores=[1.0] + [0.0] * (len(texts) - 1),
 metadata={"strategy": "strict_consensus", "consensus": True},
 )

 first = non_empty[0]
 consensus = all(t == first for t in non_empty)

 if consensus:
 chosen_index = texts.index(first)
 scores = [1.0 if t == first else 0.0 for t in texts]
 scores = _normalize_scores(scores)
 return EnsembleChoice(
 chosen_index=chosen_index,
 scores=scores,
 metadata={"strategy": "strict_consensus", "consensus": True},
 )

 if not allow_fallback:
 # Choose arbitrarily but mark as non-consensus
 return EnsembleChoice(
 chosen_index=0,
 scores=[1.0] + [0.0] * (len(texts) - 1),
 metadata={"strategy": "strict_consensus", "consensus": False},
 )

 mv = majority_vote_strategy(outputs)
 mv.metadata["consensus"] = False
 mv.metadata["strategy"] = "strict_consensus_fallback_majority"
 return mv

def weighted_consensus_strategy(
 outputs: Sequence[Dict[str, Any]],
 weights: Sequence[float],
) -> EnsembleChoice:
 """
 Weighted consensus: each provider has a prior weight and we aggregate votes
 according to weights instead of simple counts.
 """
 if not outputs:
 raise ValueError("No outputs for weighted_consensus_strategy")

 if len(outputs) != len(weights):
 raise ValueError("Length of outputs and weights must match")

 texts = [o.get("text", "") for o in outputs]
 norm_weights = _normalize_scores(list(weights))

 score_by_text: Dict[str, float] = {}
 for text, w in zip(texts, norm_weights):
 score_by_text[text] = score_by_text.get(text, 0.0) + w

 best_text, best_score = max(score_by_text.items(), key=lambda kv: kv[1])
 chosen_index = texts.index(best_text)

 per_model_scores = [score_by_text.get(t, 0.0) for t in texts]
 per_model_scores = _normalize_scores(per_model_scores)

 return EnsembleChoice(
 chosen_index=chosen_index,
 scores=per_model_scores,
 metadata={
 "strategy": "weighted_consensus",
 "score_by_text": score_by_text,
 "best_score": best_score,
 },
 )

python

Copy code

# origin/routing/enhanced_router.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Sequence, TYPE_CHECKING

from origin.ensemble.strategies import (
 EnsembleChoice,
 majority_vote_strategy,
 strict_consensus_strategy,
 weighted_consensus_strategy,
)

if TYPE_CHECKING:
 from origin.models.provider import ModelProvider
 from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
 from origin.routing.router import ModelRouter

@dataclass
class ProviderCallResult:
 provider_id: str
 text: str
 raw: Dict[str, Any]

class EnhancedModelRouter:
 """
 Adapter sitting in front of the existing ModelRouter that knows how to:

 - Call a specific set of providers for a task.
 - Aggregate their outputs with different ensemble strategies.
 - Attach EnhancedEnsembleValidator diagnostics for RQML loops.

 The underlying ModelRouter remains responsible for its default behavior.
 """

 def __init__(
 self,
 base_router: "ModelRouter",
 validator: "EnhancedEnsembleValidator",
 providers_by_id: Dict[str, "ModelProvider"],
 default_weights: Dict[str, float] | None = None,
 ) -> None:
 self.base_router = base_router
 self.validator = validator
 self.providers_by_id = providers_by_id
 self.default_weights = default_weights or {}

 def _call_providers(
 self,
 providers: Sequence["ModelProvider"],
 tenant_id: str,
 task_id: str,
 user_id: str | None,
 prompt: str,
 context: Dict[str, Any],
 ) -> List[ProviderCallResult]:
 results: List[ProviderCallResult] = []
 for p in providers:
 raw = p.infer(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=context,
 )
 # Expect raw to at least have "text"
 text = raw.get("text") or ""
 results.append(
 ProviderCallResult(
 provider_id=p.provider_id,
 text=text,
 raw=raw,
 )
 )
 return results

 def _ensemble_choice(
 self,
 outputs: List[ProviderCallResult],
 ensemble_strategy: str,
 ) -> EnsembleChoice:
 if not outputs:
 raise ValueError("No outputs to ensemble")

 payloads = [
 {"provider_id": r.provider_id, "text": r.text, **r.raw} for r in outputs
 ]

 if ensemble_strategy == "strict_consensus":
 choice = strict_consensus_strategy(payloads)
 elif ensemble_strategy == "weighted_consensus":
 weights = [
 self.default_weights.get(r.provider_id, 1.0) for r in outputs
 ]
 choice = weighted_consensus_strategy(payloads, weights=weights)
 else:
 # Default to majority vote
 choice = majority_vote_strategy(payloads)

 # Attach full validation / disagreement diagnostics
 validated = self.validator.validate(payloads)
 choice.metadata.setdefault("validated", validated)
 return choice

 # Default route behavior stays delegated to the base router

 def route_and_infer(
 self,
 tenant_id: str,
 task_id: str,
 user_id: str | None,
 prompt: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 """
 Pass-through for existing usage.
 """
 return self.base_router.route_and_infer(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=context,
 )

 def route_and_infer_with_providers(
 self,
 tenant_id: str,
 task_id: str,
 user_id: str | None,
 prompt: str,
 context: Dict[str, Any],
 providers: Sequence["ModelProvider"],
 ensemble_strategy: str,
 ) -> Dict[str, Any]:
 """
 New entry point used by policy-driven routers to:

 - Invoke a specific provider ensemble
 - Run ensemble selection
 - Return both chosen and all outputs with diagnostics
 """
 call_results = self._call_providers(
 providers=providers,
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=context,
 )

 outputs_payload = [
 {
 "provider_id": r.provider_id,
 "text": r.text,
 **{k: v for k, v in r.raw.items() if k not in ("provider_id", "text")},
 }
 for r in call_results
 ]

 choice = self._ensemble_choice(
 outputs=call_results,
 ensemble_strategy=ensemble_strategy,
 )

 chosen = outputs_payload[choice.chosen_index]

 result: Dict[str, Any] = {
 "chosen_output": chosen,
 "model_outputs": outputs_payload,
 "ensemble": {
 "strategy": ensemble_strategy,
 "scores": choice.scores,
 "metadata": choice.metadata,
 },
 # The validator has already been run inside choice.metadata["validated"]
 "context": dict(context),
 }
 return result

python

Copy code

# origin/deploy/container_v4.py

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI

from origin.scheduler.core import Scheduler
from origin.worker.core import Worker
from origin.security.rbac import AccessController
from origin.metrics.client import MetricsClient
from origin.one.repository import ONERepository
from origin.supervision.engine import SupervisionEngine # existing base
from origin.supervision.engine_v2 import AdvancedSupervisionEngine, SupervisionConfig
from origin.supervision.event_store import SupervisionEventStore
from origin.supervision.disagreement_bridge import (
 DisagreementSupervisionBridge,
 DisagreementSupervisionConfig,
)
from origin.config.safety_topics import default_topic_rules
from origin.classification import TaskClassifier # existing
from origin.routing.router import ModelRouter # existing
from origin.routing.policy_tree import build_default_policy_tree
from origin.routing.safety_policy_router import SafetyAwarePolicyRouter
from origin.routing.enhanced_router import EnhancedModelRouter
from origin.ensemble.validator import EnsembleValidator # existing
from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
from origin.rqml.loop_v2 import RQMLIntelligenceLoop, RQMLLoopConfig
from origin.rqml.prompt_refiner import PromptRefiner, PromptRefinerConfig
from origin.rqml.orchestrator import RQMLOrchestrator
from origin.integration.disagreement_monitor import DisagreementMonitor
from origin.integration.origin_pipeline_v3 import OriginPipelineV3, OriginTaskRequest
from origin.api.admin_supervision import admin_router, get_rbac, get_supervision
from origin.api.supervision_events import events_router, get_event_store
from origin.models.provider import ModelProvider # existing

class ContainerV4:
 """
 ContainerV4 upgrades ContainerV3 by inserting EnhancedModelRouter
 as the base router, enabling explicit ensemble strategies.

 No earlier modules are modified; this is a new top-level wiring.
 """

 def __init__(self) -> None:
 self.scheduler = Scheduler()
 self.worker = Worker(worker_id="origin-worker-1")
 self.rbac = AccessController()
 self.metrics = MetricsClient()
 self.one_repo = ONERepository()
 self.event_store = SupervisionEventStore()

 # Base components
 self.base_supervision = SupervisionEngine()
 self.classifier = TaskClassifier()
 self.low_level_router = ModelRouter() # legacy router
 self.base_validator = EnsembleValidator()
 self.providers_by_id: Dict[str, ModelProvider] = {}

 # Advanced supervision
 sup_config = SupervisionConfig()
 sup_config.topic_rules = default_topic_rules()
 sup_config.required_model_safety_hooks = {
 "policy_tuned",
 "self_censoring",
 }
 self.advanced_supervision = AdvancedSupervisionEngine(
 base_engine=self.base_supervision,
 classifier=self.classifier,
 config=sup_config,
 )
 self.advanced_supervision.register_event_sink(self.event_store.sink)

 # Enhanced ensemble validator
 self.enhanced_validator = EnhancedEnsembleValidator(self.base_validator)

 # Enhanced model router (ensemble-aware)
 self.enhanced_router = EnhancedModelRouter(
 base_router=self.low_level_router,
 validator=self.enhanced_validator,
 providers_by_id=self.providers_by_id,
 default_weights={},
 )

 # Safety-aware policy router, now targeting EnhancedModelRouter as "router"
 policy_tree = build_default_policy_tree()
 self.policy_router = SafetyAwarePolicyRouter(
 router=self.enhanced_router, # type: ignore[arg-type]
 supervision=self.advanced_supervision,
 policy_tree=policy_tree,
 providers_by_id=self.providers_by_id,
 )

 # Disagreement bridge
 disagreement_config = DisagreementSupervisionConfig()
 self.disagreement_bridge = DisagreementSupervisionBridge(
 supervision=self.advanced_supervision,
 metrics=self.metrics,
 config=disagreement_config,
 )

 # RQML loop
 loop_config = RQMLLoopConfig()
 self.rqml_loop = RQMLIntelligenceLoop(
 router=self.policy_router,
 validator=self.enhanced_validator,
 supervision=self.advanced_supervision,
 one_repo=self.one_repo,
 metrics=self.metrics,
 config=loop_config,
 )

 # Prompt refiner
 refiner_config = PromptRefinerConfig()
 self.prompt_refiner = PromptRefiner(
 router=self.policy_router,
 one_repo=self.one_repo,
 config=refiner_config,
 )

 # Orchestrator
 self.orchestrator = RQMLOrchestrator(
 refiner=self.prompt_refiner,
 loop=self.rqml_loop,
 supervision=self.advanced_supervision,
 )

 # Disagreement monitor
 self.disagreement_monitor = DisagreementMonitor(self.disagreement_bridge)

 # Pipeline V3
 self.pipeline = OriginPipelineV3(
 scheduler=self.scheduler,
 worker=self.worker,
 rbac=self.rbac,
 orchestrator=self.orchestrator,
 disagreement_monitor=self.disagreement_monitor,
 )

 self.app = FastAPI()
 self._wire_dependencies()
 self._register_routes()

 def _wire_dependencies(self) -> None:
 import origin.api.admin_supervision as admin
 import origin.api.supervision_events as events

 def _rbac() -> AccessController:
 return self.rbac

 def _sup() -> AdvancedSupervisionEngine:
 return self.advanced_supervision

 def _store() -> SupervisionEventStore:
 return self.event_store

 admin.get_rbac = _rbac # type: ignore[assignment]
 admin.get_supervision = _sup # type: ignore[assignment]
 events.get_rbac = _rbac # type: ignore[assignment]
 events.get_event_store = _store # type: ignore[assignment]

 def _register_routes(self) -> None:
 self.app.include_router(admin_router)
 self.app.include_router(events_router)

 @self.app.post("/origin/execute")
 async def execute_task(payload: Dict[str, any]) -> Dict[str, any]:
 req = OriginTaskRequest(
 tenant_id=payload["tenant_id"],
 task_id=payload["task_id"],
 user_id=payload.get("user_id"),
 prompt=payload["prompt"],
 metadata=payload.get("metadata", {}),
 )
 result = self.pipeline.execute(req)
 return {
 "task_id": result.task_id,
 "tenant_id": result.tenant_id,
 "user_id": result.user_id,
 "final_output": result.final_output,
 "metadata": result.metadata,
 }

def build_app_v4() -> FastAPI:
 container = ContainerV4()
 return container.app

This step adds explicit ensemble strategies, an enhanced router that can execute policy-driven multi-provider ensembles, and a v4 container wiring that sits cleanly on top of all prior ORIGIN Session #004 components without modifying earlier modules.

## User

Proceed

## ChatGPT

python

Copy code

# origin/supervision/override_store.py

from __future__ import annotations

from dataclasses import dataclass, asdict
from enum import Enum
from typing import Any, Dict, List, Optional

from .modes import OverrideDecision, SafetyMode, SupervisionEvent

class OverrideStatus(str, Enum):
 PENDING = "pending"
 APPROVED = "approved"
 DENIED = "denied"

@dataclass
class OverrideRequest:
 """
 Represents a single override request created by the supervision engine
 when escalation requires an operator decision.
 """
 id: int
 task_id: str
 user_id: Optional[str]
 status: OverrideStatus
 event_snapshot: Dict[str, Any]
 decision: Optional[OverrideDecision] = None

 def to_dict(self) -> Dict[str, Any]:
 return {
 "id": self.id,
 "task_id": self.task_id,
 "user_id": self.user_id,
 "status": self.status.value,
 "event": self.event_snapshot,
 "decision": asdict(self.decision) if self.decision else None,
 }

class OverrideStore:
 """
 In-memory store of override requests and decisions.

 Integration surfaces:
 - AdvancedSupervisionEngine override handler
 - Operator/admin HTTP APIs
 """

 def __init__(self) -> None:
 self._next_id: int = 1
 self._by_id: Dict[int, OverrideRequest] = {}
 self._by_task: Dict[str, int] = {}

 def _new_id(self) -> int:
 nid = self._next_id
 self._next_id += 1
 return nid

 def ensure_request_for_event(self, event: SupervisionEvent) -> OverrideRequest:
 """
 Idempotently create a pending override request for this task/event.
 If a request already exists for the task_id, returns it unchanged.
 """
 existing_id = self._by_task.get(event.task_id)
 if existing_id is not None:
 return self._by_id[existing_id]

 rid = self._new_id()
 req = OverrideRequest(
 id=rid,
 task_id=event.task_id,
 user_id=event.user_id,
 status=OverrideStatus.PENDING,
 event_snapshot={
 "task_id": event.task_id,
 "user_id": event.user_id,
 "mode": event.mode.value,
 "topic_tags": list(event.topic_tags),
 "risk": event.risk.value,
 "escalation_level": event.escalation_level.value,
 "message": event.message,
 "blocked": event.blocked,
 "metadata": dict(event.metadata),
 },
 )
 self._by_id[rid] = req
 self._by_task[event.task_id] = rid
 return req

 def get_decision_for_task(self, task_id: str) -> Optional[OverrideDecision]:
 """
 Returns an OverrideDecision if a non-pending decision has been recorded
 for this task, otherwise None.
 """
 rid = self._by_task.get(task_id)
 if rid is None:
 return None
 req = self._by_id[rid]
 if req.status in (OverrideStatus.APPROVED, OverrideStatus.DENIED) and req.decision:
 return req.decision
 return None

 def list_requests(
 self,
 status: Optional[OverrideStatus] = None,
 limit: int = 100,
 offset: int = 0,
 ) -> List[Dict[str, Any]]:
 items = list(self._by_id.values())
 if status is not None:
 items = [r for r in items if r.status == status]
 # newest first by id
 items.sort(key=lambda r: r.id, reverse=True)
 sliced = items[offset : offset + limit]
 return [r.to_dict() for r in sliced]

 def get_request(self, request_id: int) -> Optional[OverrideRequest]:
 return self._by_id.get(request_id)

 def set_decision(
 self,
 request_id: int,
 approved: bool,
 reason: str,
 operator_id: str,
 new_mode: Optional[SafetyMode] = None,
 ) -> OverrideRequest:
 req = self._by_id[request_id]
 status = OverrideStatus.APPROVED if approved else OverrideStatus.DENIED
 decision = OverrideDecision(
 approved=approved,
 reason=reason,
 operator_id=operator_id,
 new_mode=new_mode,
 )
 req.status = status
 req.decision = decision
 return req

python

Copy code

# origin/supervision/override_handler.py

from __future__ import annotations

from typing import Optional

from .modes import OverrideDecision
from .override_store import OverrideStore
from .modes import SupervisionEvent

def make_override_handler(store: OverrideStore):
 """
 Factory returning an override handler suitable for
 AdvancedSupervisionEngine.register_override_handler.
 """

 def handler(event: SupervisionEvent) -> Optional[OverrideDecision]:
 # First check if a decision already exists for this task.
 decision = store.get_decision_for_task(event.task_id)
 if decision is not None:
 return decision

 # If not, ensure a pending override request exists for operators.
 store.ensure_request_for_event(event)
 # No decision yet; supervision engine will treat as “no override”.
 return None

 return handler

python

Copy code

# origin/api/supervision_overrides.py

from __future__ import annotations

from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query

from origin.security.rbac import AccessController, Role
from origin.supervision.override_store import OverrideStore, OverrideStatus
from origin.supervision.modes import SafetyMode
from origin.supervision.engine_v2 import AdvancedSupervisionEngine

def get_rbac() -> AccessController:
 raise NotImplementedError

def get_override_store() -> OverrideStore:
 raise NotImplementedError

def get_supervision() -> AdvancedSupervisionEngine:
 raise NotImplementedError

overrides_router = APIRouter(
 prefix="/admin/supervision/overrides", tags=["admin.supervision.overrides"]
)

def _require_operator(
 tenant_id: str,
 user_id: str,
 rbac: AccessController,
) -> None:
 if not (
 rbac.has_role(tenant_id=tenant_id, user_id=user_id, role=Role.ADMIN)
 or rbac.has_role(tenant_id=tenant_id, user_id=user_id, role=Role.OPERATOR)
 ):
 raise HTTPException(status_code=403, detail="Operator or admin role required")

@overrides_router.get("/")
def list_override_requests(
 tenant_id: str,
 user_id: str,
 status: Optional[str] = Query(None, description="pending|approved|denied"),
 limit: int = Query(100, ge=1, le=500),
 offset: int = Query(0, ge=0),
 rbac: AccessController = Depends(get_rbac),
 store: OverrideStore = Depends(get_override_store),
) -> Dict[str, Any]:
 _require_operator(tenant_id=tenant_id, user_id=user_id, rbac=rbac)

 status_enum: Optional[OverrideStatus] = None
 if status is not None:
 try:
 status_enum = OverrideStatus(status)
 except ValueError:
 raise HTTPException(status_code=400, detail="Invalid status filter")

 items = store.list_requests(status=status_enum, limit=limit, offset=offset)
 return {"items": items, "count": len(items)}

@overrides_router.get("/{request_id}")
def get_override_request(
 tenant_id: str,
 user_id: str,
 request_id: int,
 rbac: AccessController = Depends(get_rbac),
 store: OverrideStore = Depends(get_override_store),
) -> Dict[str, Any]:
 _require_operator(tenant_id=tenant_id, user_id=user_id, rbac=rbac)

 req = store.get_request(request_id)
 if not req:
 raise HTTPException(status_code=404, detail="Override request not found")
 return req.to_dict()

@overrides_router.post("/{request_id}/decision")
def set_override_decision(
 tenant_id: str,
 user_id: str,
 request_id: int,
 payload: Dict[str, Any],
 rbac: AccessController = Depends(get_rbac),
 store: OverrideStore = Depends(get_override_store),
 supervision: AdvancedSupervisionEngine = Depends(get_supervision),
) -> Dict[str, Any]:
 _require_operator(tenant_id=tenant_id, user_id=user_id, rbac=rbac)

 approved = bool(payload.get("approved", False))
 reason = payload.get("reason", "")
 if not reason:
 raise HTTPException(status_code=400, detail="Reason is required")

 new_mode_value = payload.get("new_mode")
 new_mode: Optional[SafetyMode] = None
 if new_mode_value is not None:
 if new_mode_value not in SafetyMode._value2member_map_:
 raise HTTPException(status_code=400, detail="Invalid safety mode")
 new_mode = SafetyMode(new_mode_value)

 req = store.get_request(request_id)
 if not req:
 raise HTTPException(status_code=404, detail="Override request not found")

 updated = store.set_decision(
 request_id=request_id,
 approved=approved,
 reason=reason,
 operator_id=user_id,
 new_mode=new_mode,
 )

 # Optionally update tenant mode if requested
 if new_mode is not None:
 supervision.set_tenant_mode(tenant_id, new_mode)

 return updated.to_dict()

python

Copy code

# origin/deploy/container_v5.py

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI

from origin.scheduler.core import Scheduler
from origin.worker.core import Worker
from origin.security.rbac import AccessController
from origin.metrics.client import MetricsClient
from origin.one.repository import ONERepository
from origin.supervision.engine import SupervisionEngine # existing base
from origin.supervision.engine_v2 import AdvancedSupervisionEngine, SupervisionConfig
from origin.supervision.event_store import SupervisionEventStore
from origin.supervision.override_store import OverrideStore
from origin.supervision.override_handler import make_override_handler
from origin.supervision.disagreement_bridge import (
 DisagreementSupervisionBridge,
 DisagreementSupervisionConfig,
)
from origin.config.safety_topics import default_topic_rules
from origin.classification import TaskClassifier # existing
from origin.routing.router import ModelRouter # existing
from origin.routing.policy_tree import build_default_policy_tree
from origin.routing.safety_policy_router import SafetyAwarePolicyRouter
from origin.routing.enhanced_router import EnhancedModelRouter
from origin.ensemble.validator import EnsembleValidator # existing
from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
from origin.rqml.loop_v2 import RQMLIntelligenceLoop, RQMLLoopConfig
from origin.rqml.prompt_refiner import PromptRefiner, PromptRefinerConfig
from origin.rqml.orchestrator import RQMLOrchestrator
from origin.integration.disagreement_monitor import DisagreementMonitor
from origin.integration.origin_pipeline_v3 import OriginPipelineV3, OriginTaskRequest
from origin.api.admin_supervision import admin_router, get_rbac, get_supervision
from origin.api.supervision_events import events_router, get_event_store
from origin.api.supervision_overrides import overrides_router, get_override_store
from origin.models.provider import ModelProvider # existing

class ContainerV5:
 """
 ContainerV5 adds:

 - OverrideStore and override handler wiring
 - HTTP APIs for listing and deciding overrides

 This completes dynamic safety modes, escalation, and operator override flows.
 """

 def __init__(self) -> None:
 self.scheduler = Scheduler()
 self.worker = Worker(worker_id="origin-worker-1")
 self.rbac = AccessController()
 self.metrics = MetricsClient()
 self.one_repo = ONERepository()
 self.event_store = SupervisionEventStore()
 self.override_store = OverrideStore()

 # Base components
 self.base_supervision = SupervisionEngine()
 self.classifier = TaskClassifier()
 self.low_level_router = ModelRouter()
 self.base_validator = EnsembleValidator()
 self.providers_by_id: Dict[str, ModelProvider] = {}

 # Advanced supervision
 sup_config = SupervisionConfig()
 sup_config.topic_rules = default_topic_rules()
 sup_config.required_model_safety_hooks = {
 "policy_tuned",
 "self_censoring",
 }
 self.advanced_supervision = AdvancedSupervisionEngine(
 base_engine=self.base_supervision,
 classifier=self.classifier,
 config=sup_config,
 )
 self.advanced_supervision.register_event_sink(self.event_store.sink)
 self.advanced_supervision.register_override_handler(
 make_override_handler(self.override_store)
 )

 # Disagreement bridge
 disagreement_config = DisagreementSupervisionConfig()
 self.disagreement_bridge = DisagreementSupervisionBridge(
 supervision=self.advanced_supervision,
 metrics=self.metrics,
 config=disagreement_config,
 )

 # Enhanced ensemble validator
 self.enhanced_validator = EnhancedEnsembleValidator(self.base_validator)

 # Enhanced model router (ensemble-aware)
 self.enhanced_router = EnhancedModelRouter(
 base_router=self.low_level_router,
 validator=self.enhanced_validator,
 providers_by_id=self.providers_by_id,
 default_weights={},
 )

 # Safety-aware policy router
 policy_tree = build_default_policy_tree()
 self.policy_router = SafetyAwarePolicyRouter(
 router=self.enhanced_router, # type: ignore[arg-type]
 supervision=self.advanced_supervision,
 policy_tree=policy_tree,
 providers_by_id=self.providers_by_id,
 )

 # RQML loop
 loop_config = RQMLLoopConfig()
 self.rqml_loop = RQMLIntelligenceLoop(
 router=self.policy_router,
 validator=self.enhanced_validator,
 supervision=self.advanced_supervision,
 one_repo=self.one_repo,
 metrics=self.metrics,
 config=loop_config,
 )

 # Prompt refiner
 refiner_config = PromptRefinerConfig()
 self.prompt_refiner = PromptRefiner(
 router=self.policy_router,
 one_repo=self.one_repo,
 config=refiner_config,
 )

 # Orchestrator
 self.orchestrator = RQMLOrchestrator(
 refiner=self.prompt_refiner,
 loop=self.rqml_loop,
 supervision=self.advanced_supervision,
 )

 # Disagreement monitor
 self.disagreement_monitor = DisagreementMonitor(self.disagreement_bridge)

 # Pipeline V3
 self.pipeline = OriginPipelineV3(
 scheduler=self.scheduler,
 worker=self.worker,
 rbac=self.rbac,
 orchestrator=self.orchestrator,
 disagreement_monitor=self.disagreement_monitor,
 )

 self.app = FastAPI()
 self._wire_dependencies()
 self._register_routes()

 def _wire_dependencies(self) -> None:
 import origin.api.admin_supervision as admin
 import origin.api.supervision_events as events
 import origin.api.supervision_overrides as overrides

 def _rbac() -> AccessController:
 return self.rbac

 def _sup() -> AdvancedSupervisionEngine:
 return self.advanced_supervision

 def _store() -> SupervisionEventStore:
 return self.event_store

 def _override_store() -> OverrideStore:
 return self.override_store

 admin.get_rbac = _rbac # type: ignore[assignment]
 admin.get_supervision = _sup # type: ignore[assignment]
 events.get_rbac = _rbac # type: ignore[assignment]
 events.get_event_store = _store # type: ignore[assignment]
 overrides.get_rbac = _rbac # type: ignore[assignment]
 overrides.get_override_store = _override_store # type: ignore[assignment]
 overrides.get_supervision = _sup # type: ignore[assignment]

 def _register_routes(self) -> None:
 self.app.include_router(admin_router)
 self.app.include_router(events_router)
 self.app.include_router(overrides_router)

 @self.app.post("/origin/execute")
 async def execute_task(payload: Dict[str, any]) -> Dict[str, any]:
 req = OriginTaskRequest(
 tenant_id=payload["tenant_id"],
 task_id=payload["task_id"],
 user_id=payload.get("user_id"),
 prompt=payload["prompt"],
 metadata=payload.get("metadata", {}),
 )
 result = self.pipeline.execute(req)
 return {
 "task_id": result.task_id,
 "tenant_id": result.tenant_id,
 "user_id": result.user_id,
 "final_output": result.final_output,
 "metadata": result.metadata,
 }

def build_app_v5() -> FastAPI:
 container = ContainerV5()
 return container.app

## User

Proceed

## ChatGPT

python

Copy code

# origin/models/reliability.py

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

@dataclass
class ProviderStats:
 provider_id: str
 calls: int = 0
 chosen: int = 0
 disagreements: int = 0
 overrides_involved: int = 0

 @property
 def reliability(self) -> float:
 if self.calls == 0:
 return 1.0
 base = self.chosen / self.calls
 penalty = 0.1 * self.disagreements / self.calls
 override_penalty = 0.2 * self.overrides_involved / max(self.calls, 1)
 score = base - penalty - override_penalty
 return max(0.05, min(1.0, score))

 def to_dict(self) -> Dict[str, Any]:
 d = asdict(self)
 d["reliability"] = self.reliability
 return d

class ProviderReliabilityRegistry:
 """
 Tracks per-provider reliability from ensemble outcomes and supervision metadata.

 Integration surfaces:
 - ReliabilityAwareModelRouter to derive dynamic weights.
 - Operator/admin dashboards via stats().
 """

 def __init__(self) -> None:
 self._stats: Dict[str, ProviderStats] = {}

 def _get(self, provider_id: str) -> ProviderStats:
 if provider_id not in self._stats:
 self._stats[provider_id] = ProviderStats(provider_id=provider_id)
 return self._stats[provider_id]

 def record_cycle(
 self,
 provider_scores: List[Dict[str, Any]],
 chosen_provider_id: Optional[str],
 disagreement_pairwise: float,
 override_applied: bool,
 ) -> None:
 """
 provider_scores: from EnhancedEnsembleValidator, each includes:
 - "provider_id"
 - "score" (vote or weight contribution)
 """
 for ps in provider_scores:
 pid = ps.get("provider_id")
 if not pid:
 continue
 st = self._get(pid)
 st.calls += 1
 # If this provider supplied the final chosen answer, bump chosen
 if chosen_provider_id and pid == chosen_provider_id:
 st.chosen += 1
 # If disagreement was high, mark all participants
 if disagreement_pairwise > 0.5:
 st.disagreements += 1
 if override_applied:
 st.overrides_involved += 1

 def weights_for_providers(self, provider_ids: List[str]) -> List[float]:
 return [self._get(pid).reliability for pid in provider_ids]

 def stats(self) -> Dict[str, Dict[str, Any]]:
 return {pid: st.to_dict() for pid, st in self._stats.items()}

python

Copy code

# origin/integration/reliability_monitor.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from origin.models.reliability import ProviderReliabilityRegistry

@dataclass
class ReliabilityMonitor:
 """
 Inspects RQML results and updates provider reliability registry.

 Intended to be invoked by the pipeline after each RQML cycle.
 """
 registry: ProviderReliabilityRegistry

 def inspect_rqml_result(
 self,
 rqml_result: Dict[str, Any],
 ) -> None:
 validated = rqml_result.get("validated", {})
 ensemble = validated.get("ensemble", {})
 disagreement = ensemble.get("disagreement", {})
 provider_scores = disagreement.get("provider_scores", [])

 chosen = rqml_result.get("outputs", [])
 chosen_provider_id: Optional[str] = None
 if chosen:
 first = chosen[0]
 chosen_provider_id = first.get("provider_id")

 pairwise = float(disagreement.get("pairwise", 0.0))
 override_applied = bool(
 rqml_result.get("context", {})
 .get("supervision", {})
 .get("override_applied", False)
 )

 self.registry.record_cycle(
 provider_scores=provider_scores,
 chosen_provider_id=chosen_provider_id,
 disagreement_pairwise=pairwise,
 override_applied=override_applied,
 )

python

Copy code

# origin/routing/reliability_router.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Sequence, TYPE_CHECKING

from origin.ensemble.strategies import (
 EnsembleChoice,
 majority_vote_strategy,
 strict_consensus_strategy,
 weighted_consensus_strategy,
)

from origin.models.reliability import ProviderReliabilityRegistry

if TYPE_CHECKING:
 from origin.models.provider import ModelProvider
 from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator

@dataclass
class ProviderCallResult:
 provider_id: str
 text: str
 raw: Dict[str, Any]

class ReliabilityAwareModelRouter:
 """
 Ensemble-aware router that uses ProviderReliabilityRegistry to derive dynamic
 weights for providers, and exposes explicit ensemble strategies.

 Designed to be used by SafetyAwarePolicyRouter as its underlying router.
 """

 def __init__(
 self,
 validator: "EnhancedEnsembleValidator",
 providers_by_id: Dict[str, "ModelProvider"],
 reliability_registry: ProviderReliabilityRegistry,
 ) -> None:
 self.validator = validator
 self.providers_by_id = providers_by_id
 self.reliability_registry = reliability_registry

 def _call_providers(
 self,
 providers: Sequence["ModelProvider"],
 tenant_id: str,
 task_id: str,
 user_id: str | None,
 prompt: str,
 context: Dict[str, Any],
 ) -> List[ProviderCallResult]:
 results: List[ProviderCallResult] = []
 for p in providers:
 raw = p.infer(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=context,
 )
 text = raw.get("text") or ""
 results.append(
 ProviderCallResult(
 provider_id=p.provider_id,
 text=text,
 raw=raw,
 )
 )
 return results

 def _ensemble_choice(
 self,
 outputs: List[ProviderCallResult],
 ensemble_strategy: str,
 ) -> EnsembleChoice:
 if not outputs:
 raise ValueError("No outputs to ensemble")

 payloads = [
 {"provider_id": r.provider_id, "text": r.text, **r.raw} for r in outputs
 ]
 provider_ids = [r.provider_id for r in outputs]

 # Fetch dynamic weights from reliability registry
 weights = self.reliability_registry.weights_for_providers(provider_ids)

 if ensemble_strategy == "strict_consensus":
 choice = strict_consensus_strategy(payloads)
 elif ensemble_strategy == "weighted_consensus":
 choice = weighted_consensus_strategy(payloads, weights=weights)
 else:
 # For majority_vote, we still run validator for diagnostics.
 choice = majority_vote_strategy(payloads)

 validated = self.validator.validate(payloads)
 choice.metadata.setdefault("validated", validated)
 choice.metadata.setdefault("reliability_weights", weights)
 return choice

 # API expected by SafetyAwarePolicyRouter

 def route_and_infer(
 self,
 tenant_id: str,
 task_id: str,
 user_id: str | None,
 prompt: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 """
 Default behavior: single-provider pass-through based on a "default" provider
 inferred from context. For now, we require the caller to use
 route_and_infer_with_providers for ensembles.
 """
 raise NotImplementedError(
 "ReliabilityAwareModelRouter should be used via route_and_infer_with_providers"
 )

 def route_and_infer_with_providers(
 self,
 tenant_id: str,
 task_id: str,
 user_id: str | None,
 prompt: str,
 context: Dict[str, Any],
 providers: Sequence["ModelProvider"],
 ensemble_strategy: str,
 ) -> Dict[str, Any]:
 call_results = self._call_providers(
 providers=providers,
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=context,
 )

 outputs_payload = [
 {
 "provider_id": r.provider_id,
 "text": r.text,
 **{k: v for k, v in r.raw.items() if k not in ("provider_id", "text")},
 }
 for r in call_results
 ]

 choice = self._ensemble_choice(
 outputs=call_results,
 ensemble_strategy=ensemble_strategy,
 )

 chosen = outputs_payload[choice.chosen_index]

 result: Dict[str, Any] = {
 "chosen_output": chosen,
 "model_outputs": outputs_payload,
 "ensemble": {
 "strategy": ensemble_strategy,
 "scores": choice.scores,
 "metadata": choice.metadata,
 },
 "context": dict(context),
 }
 return result

python

Copy code

# origin/integration/origin_pipeline_v4.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, TYPE_CHECKING

from origin.integration.origin_pipeline import OriginTaskRequest, OriginTaskResult

if TYPE_CHECKING:
 from origin.scheduler.core import Scheduler
 from origin.worker.core import Worker
 from origin.security.rbac import AccessController
 from origin.integration.disagreement_monitor import DisagreementMonitor
 from origin.integration.reliability_monitor import ReliabilityMonitor
 from origin.rqml.orchestrator import RQMLOrchestrator

@dataclass
class OriginPipelineV4:
 """
 Extends OriginPipelineV3 by adding provider reliability monitoring.
 """
 scheduler: "Scheduler"
 worker: "Worker"
 rbac: "AccessController"
 orchestrator: "RQMLOrchestrator"
 disagreement_monitor: "DisagreementMonitor"
 reliability_monitor: "ReliabilityMonitor"

 def _check_access(self, request: OriginTaskRequest) -> None:
 allowed = self.rbac.can_execute_task(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_metadata=request.metadata,
 )
 if not allowed:
 raise PermissionError(
 f"User {request.user_id} is not allowed to execute task {request.task_id}"
 )

 def execute(self, request: OriginTaskRequest) -> OriginTaskResult:
 self._check_access(request)

 slot = self.scheduler.reserve_slot(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_id=request.task_id,
 metadata=request.metadata,
 )

 try:
 base_context: Dict[str, Any] = {
 "scheduler": {"slot_id": slot.slot_id},
 "metadata": dict(request.metadata),
 }

 worker_context = self.worker.prepare_context(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 context=base_context,
 )

 rqml_result = self.orchestrator.execute(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 prompt=request.prompt,
 context=worker_context,
 )

 self.disagreement_monitor.inspect_rqml_result(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 rqml_result=rqml_result,
 )

 self.reliability_monitor.inspect_rqml_result(
 rqml_result=rqml_result,
 )

 final_payload = self.worker.finalize_result(
 tenant_id=request.tenant_id,
 task_id=request.task_id,
 user_id=request.user_id,
 rqml_result=rqml_result,
 )

 return OriginTaskResult(
 task_id=request.task_id,
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 final_output=final_payload,
 metadata={
 "scheduler_slot": slot.to_dict(),
 "rqml_consensus_score": rqml_result["context"]
 .get("rqml", {})
 .get("last_consensus_score"),
 "rqml_pairwise_disagreement": rqml_result["context"]
 .get("rqml", {})
 .get("last_pairwise_disagreement"),
 "refined_prompt": rqml_result["context"]
 .get("rqml", {})
 .get("refined_prompt"),
 },
 )
 finally:
 self.scheduler.release_slot(
 tenant_id=request.tenant_id,
 user_id=request.user_id,
 task_id=request.task_id,
 slot_id=slot.slot_id,
 )

python

Copy code

# origin/api/reliability_admin.py

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from origin.security.rbac import AccessController, Role
from origin.models.reliability import ProviderReliabilityRegistry

def get_rbac() -> AccessController:
 raise NotImplementedError

def get_reliability_registry() -> ProviderReliabilityRegistry:
 raise NotImplementedError

reliability_router = APIRouter(
 prefix="/admin/reliability", tags=["admin.reliability"]
)

def _require_operator(
 tenant_id: str,
 user_id: str,
 rbac: AccessController,
) -> None:
 if not (
 rbac.has_role(tenant_id=tenant_id, user_id=user_id, role=Role.ADMIN)
 or rbac.has_role(tenant_id=tenant_id, user_id=user_id, role=Role.OPERATOR)
 ):
 raise HTTPException(status_code=403, detail="Operator or admin role required")

@reliability_router.get("/providers")
def list_provider_reliability(
 tenant_id: str,
 user_id: str,
 rbac: AccessController = Depends(get_rbac),
 registry: ProviderReliabilityRegistry = Depends(get_reliability_registry),
) -> Dict[str, Any]:
 _require_operator(tenant_id=tenant_id, user_id=user_id, rbac=rbac)
 return {"providers": registry.stats()}

python

Copy code

# origin/deploy/container_v6.py

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI

from origin.scheduler.core import Scheduler
from origin.worker.core import Worker
from origin.security.rbac import AccessController
from origin.metrics.client import MetricsClient
from origin.one.repository import ONERepository
from origin.supervision.engine import SupervisionEngine # existing base
from origin.supervision.engine_v2 import AdvancedSupervisionEngine, SupervisionConfig
from origin.supervision.event_store import SupervisionEventStore
from origin.supervision.override_store import OverrideStore
from origin.supervision.override_handler import make_override_handler
from origin.supervision.disagreement_bridge import (
 DisagreementSupervisionBridge,
 DisagreementSupervisionConfig,
)
from origin.config.safety_topics import default_topic_rules
from origin.classification import TaskClassifier # existing
from origin.routing.policy_tree import build_default_policy_tree
from origin.routing.safety_policy_router import SafetyAwarePolicyRouter
from origin.routing.reliability_router import ReliabilityAwareModelRouter
from origin.ensemble.validator import EnsembleValidator # existing
from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
from origin.rqml.loop_v2 import RQMLIntelligenceLoop, RQMLLoopConfig
from origin.rqml.prompt_refiner import PromptRefiner, PromptRefinerConfig
from origin.rqml.orchestrator import RQMLOrchestrator
from origin.integration.disagreement_monitor import DisagreementMonitor
from origin.integration.reliability_monitor import ReliabilityMonitor
from origin.integration.origin_pipeline_v4 import OriginPipelineV4, OriginTaskRequest
from origin.api.admin_supervision import admin_router, get_rbac, get_supervision
from origin.api.supervision_events import events_router, get_event_store
from origin.api.supervision_overrides import overrides_router, get_override_store
from origin.api.reliability_admin import reliability_router, get_reliability_registry
from origin.models.provider import ModelProvider # existing
from origin.models.reliability import ProviderReliabilityRegistry

class ContainerV6:
 """
 ContainerV6:

 - Uses ReliabilityAwareModelRouter with ProviderReliabilityRegistry
 - Feeds reliability from RQML -> ReliabilityMonitor
 - Exposes admin API for provider reliability stats

 Builds on all prior ORIGIN XI Session #004 components without changing them.
 """

 def __init__(self) -> None:
 self.scheduler = Scheduler()
 self.worker = Worker(worker_id="origin-worker-1")
 self.rbac = AccessController()
 self.metrics = MetricsClient()
 self.one_repo = ONERepository()
 self.event_store = SupervisionEventStore()
 self.override_store = OverrideStore()
 self.reliability_registry = ProviderReliabilityRegistry()

 # Base components and models
 self.base_supervision = SupervisionEngine()
 self.classifier = TaskClassifier()
 self.base_validator = EnsembleValidator()
 self.providers_by_id: Dict[str, ModelProvider] = {}

 # Advanced supervision
 sup_config = SupervisionConfig()
 sup_config.topic_rules = default_topic_rules()
 sup_config.required_model_safety_hooks = {
 "policy_tuned",
 "self_censoring",
 }
 self.advanced_supervision = AdvancedSupervisionEngine(
 base_engine=self.base_supervision,
 classifier=self.classifier,
 config=sup_config,
 )
 self.advanced_supervision.register_event_sink(self.event_store.sink)
 self.advanced_supervision.register_override_handler(
 make_override_handler(self.override_store)
 )

 # Disagreement bridge
 disagreement_config = DisagreementSupervisionConfig()
 self.disagreement_bridge = DisagreementSupervisionBridge(
 supervision=self.advanced_supervision,
 metrics=self.metrics,
 config=disagreement_config,
 )

 # Enhanced ensemble validator
 self.enhanced_validator = EnhancedEnsembleValidator(self.base_validator)

 # Reliability-aware ensemble router
 self.reliability_router = ReliabilityAwareModelRouter(
 validator=self.enhanced_validator,
 providers_by_id=self.providers_by_id,
 reliability_registry=self.reliability_registry,
 )

 # Safety-aware policy router on top of reliability router
 policy_tree = build_default_policy_tree()
 self.policy_router = SafetyAwarePolicyRouter(
 router=self.reliability_router, # type: ignore[arg-type]
 supervision=self.advanced_supervision,
 policy_tree=policy_tree,
 providers_by_id=self.providers_by_id,
 )

 # RQML loop
 loop_config = RQMLLoopConfig()
 self.rqml_loop = RQMLIntelligenceLoop(
 router=self.policy_router,
 validator=self.enhanced_validator,
 supervision=self.advanced_supervision,
 one_repo=self.one_repo,
 metrics=self.metrics,
 config=loop_config,
 )

 # Prompt refiner
 refiner_config = PromptRefinerConfig()
 self.prompt_refiner = PromptRefiner(
 router=self.policy_router,
 one_repo=self.one_repo,
 config=refiner_config,
 )

 # Orchestrator
 self.orchestrator = RQMLOrchestrator(
 refiner=self.prompt_refiner,
 loop=self.rqml_loop,
 supervision=self.advanced_supervision,
 )

 # Monitors
 self.disagreement_monitor = DisagreementMonitor(self.disagreement_bridge)
 self.reliability_monitor = ReliabilityMonitor(self.reliability_registry)

 # Pipeline V4
 self.pipeline = OriginPipelineV4(
 scheduler=self.scheduler,
 worker=self.worker,
 rbac=self.rbac,
 orchestrator=self.orchestrator,
 disagreement_monitor=self.disagreement_monitor,
 reliability_monitor=self.reliability_monitor,
 )

 self.app = FastAPI()
 self._wire_dependencies()
 self._register_routes()

 def _wire_dependencies(self) -> None:
 import origin.api.admin_supervision as admin
 import origin.api.supervision_events as events
 import origin.api.supervision_overrides as overrides
 import origin.api.reliability_admin as reliability

 def _rbac() -> AccessController:
 return self.rbac

 def _sup() -> AdvancedSupervisionEngine:
 return self.advanced_supervision

 def _event_store() -> SupervisionEventStore:
 return self.event_store

 def _override_store() -> OverrideStore:
 return self.override_store

 def _rel_registry() -> ProviderReliabilityRegistry:
 return self.reliability_registry

 admin.get_rbac = _rbac # type: ignore[assignment]
 admin.get_supervision = _sup # type: ignore[assignment]
 events.get_rbac = _rbac # type: ignore[assignment]
 events.get_event_store = _event_store # type: ignore[assignment]
 overrides.get_rbac = _rbac # type: ignore[assignment]
 overrides.get_override_store = _override_store # type: ignore[assignment]
 overrides.get_supervision = _sup # type: ignore[assignment]
 reliability.get_rbac = _rbac # type: ignore[assignment]
 reliability.get_reliability_registry = _rel_registry # type: ignore[assignment]

 def _register_routes(self) -> None:
 self.app.include_router(admin_router)
 self.app.include_router(events_router)
 self.app.include_router(overrides_router)
 self.app.include_router(reliability_router)

 @self.app.post("/origin/execute")
 async def execute_task(payload: Dict[str, any]) -> Dict[str, any]:
 req = OriginTaskRequest(
 tenant_id=payload["tenant_id"],
 task_id=payload["task_id"],
 user_id=payload.get("user_id"),
 prompt=payload["prompt"],
 metadata=payload.get("metadata", {}),
 )
 result = self.pipeline.execute(req)
 return {
 "task_id": result.task_id,
 "tenant_id": result.tenant_id,
 "user_id": result.user_id,
 "final_output": result.final_output,
 "metadata": result.metadata,
 }

def build_app_v6() -> FastAPI:
 container = ContainerV6()
 return container.app

## User

Proceed

## ChatGPT

python

Copy code

# origin/rqml/agreement.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Sequence, Tuple

@dataclass
class AgreementMetrics:
 """
 Captures cross-model agreement statistics for a single RQML iteration.
 """
 consensus_score: float
 pairwise_disagreement: float
 vote_counts: Dict[str, int]

def _text_key(text: str) -> str:
 """
 Normalizes a model output for agreement comparison.
 """
 return " ".join(text.strip().split()).lower()

def compute_agreement_metrics(
 outputs: Sequence[Dict[str, Any]],
) -> AgreementMetrics:
 """
 Naive agreement metrics based on exact match of normalized strings.

 consensus_score = max_votes / total_outputs
 pairwise_disagreement = 1 - consensus_score
 """
 if not outputs:
 return AgreementMetrics(
 consensus_score=0.0,
 pairwise_disagreement=1.0,
 vote_counts={},
 )

 keys: List[str] = [_text_key(o.get("text", "") or "") for o in outputs]
 counts: Dict[str, int] = {}
 for k in keys:
 counts[k] = counts.get(k, 0) + 1

 max_votes = max(counts.values())
 total = len(outputs)
 consensus = float(max_votes) / float(total) if total > 0 else 0.0
 pairwise = 1.0 - consensus

 return AgreementMetrics(
 consensus_score=consensus,
 pairwise_disagreement=pairwise,
 vote_counts=counts,
 )

python

Copy code

# origin/rqml/convergence.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

@dataclass
class ConvergenceConfig:
 """
 Controls when the RQML loop stops iterating.
 """
 max_iterations: int = 4
 min_consensus_for_early_stop: float = 0.82
 min_delta_consensus: float = 0.02
 require_monotonic_consensus: bool = False
 min_iterations: int = 1

@dataclass
class ConvergenceState:
 last_consensus: Optional[float] = None
 iterations: int = 0
 improved_monotonic: bool = True

class ConvergenceController:
 """
 Implements a simple convergence rule based on consensus scores.
 """

 def __init__(self, config: Optional[ConvergenceConfig] = None) -> None:
 self.config = config or ConvergenceConfig()
 self.state = ConvergenceState()

 def update_from_iteration(self, consensus_score: float) -> None:
 s = self.state
 if s.last_consensus is None:
 s.last_consensus = consensus_score
 s.iterations = 1
 return

 if self.config.require_monotonic_consensus:
 if consensus_score + 1e-6 < s.last_consensus:
 s.improved_monotonic = False

 s.iterations += 1
 s.last_consensus = consensus_score

 def should_continue(self) -> bool:
 s = self.state
 cfg = self.config

 # Always ensure at least min_iterations
 if s.iterations < cfg.min_iterations:
 return True

 # Stop if we reached max_iterations
 if s.iterations >= cfg.max_iterations:
 return False

 # If we never got a consensus reading, continue
 if s.last_consensus is None:
 return True

 # Early stop based on consensus threshold
 if s.last_consensus >= cfg.min_consensus_for_early_stop:
 return False

 # If monotonic improvement is required and was broken, stop
 if cfg.require_monotonic_consensus and not s.improved_monotonic:
 return False

 # Otherwise continue to next iteration
 return True

python

Copy code

# origin/rqml/ontology_reinforcer.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
 from origin.one.repository import ONERepository

@dataclass
class OntologyReinforcerConfig:
 """
 Controls how RQML cycles are projected into ONE.

 For now this is a light abstraction; a full implementation would
 align entities/relations into a graph or ontology store.
 """
 store_raw_outputs: bool = True
 store_summary_only: bool = False
 max_output_chars: int = 4000
 ontology_hint_key: str = "ontology_hints"

class OntologyReinforcer:
 """
 Takes the outputs of an RQML cycle and writes a compressed representation
 into ONE, optionally including ontology hints that can be fed back into
 prompt refinement on subsequent cycles.
 """

 def __init__(
 self,
 one_repo: "ONERepository",
 config: Optional[OntologyReinforcerConfig] = None,
 ) -> None:
 self.one_repo = one_repo
 self.config = config or OntologyReinforcerConfig()

 def _truncate(self, text: str) -> str:
 if len(text) <= self.config.max_output_chars:
 return text
 return text[: self.config.max_output_chars]

 def reinforce(
 self,
 tenant_id: str,
 task_id: str,
 chosen_output: Dict[str, Any],
 all_outputs: List[Dict[str, Any]],
 rqml_context: Dict[str, Any],
 ) -> None:
 """
 Stores a compressed cycle snapshot into ONE.

 The structure is deliberately simple and can be upgraded later.
 """
 chosen_text = self._truncate(chosen_output.get("text", "") or "")

 stored: Dict[str, Any] = {
 "chosen": {
 "provider_id": chosen_output.get("provider_id"),
 "text": chosen_text,
 },
 "iterations": rqml_context.get("path", []),
 "last_consensus_score": rqml_context.get("last_consensus_score"),
 "last_pairwise_disagreement": rqml_context.get(
 "last_pairwise_disagreement"
 ),
 }

 if self.config.store_raw_outputs:
 stored["all_outputs"] = [
 {
 "provider_id": o.get("provider_id"),
 "text": self._truncate(o.get("text", "") or ""),
 }
 for o in all_outputs
 ]

 # Placeholder: Generate ontology hints by simple summarization of the chosen text.
 # A more advanced implementation would call a dedicated summarizer.
 if not self.config.store_summary_only:
 stored[self.config.ontology_hint_key] = chosen_text

 self.one_repo.reinforce_from_rqml_cycle(
 tenant_id=tenant_id,
 task_id=task_id,
 cycle=stored,
 )

python

Copy code

# origin/rqml/loop_v3.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from origin.rqml.convergence import ConvergenceConfig, ConvergenceController
from origin.rqml.agreement import compute_agreement_metrics, AgreementMetrics
from origin.rqml.ontology_reinforcer import OntologyReinforcer, OntologyReinforcerConfig

if TYPE_CHECKING:
 from origin.routing.policy_tree import PolicyDrivenRouterAdapter
 from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
 from origin.supervision.engine_v2 import AdvancedSupervisionEngine
 from origin.one.repository import ONERepository
 from origin.metrics.client import MetricsClient

@dataclass
class RQMLLoopConfig:
 """
 Configuration for the RQMLIntelligenceLoopV3.

 Combines convergence, ensemble strategy, and basic logging toggles.
 """
 max_iterations: int = 4
 min_consensus_for_early_stop: float = 0.82
 min_delta_consensus: float = 0.02
 require_monotonic_consensus: bool = False
 min_iterations: int = 1
 ensemble_strategy: str = "weighted_consensus" # or "strict_consensus", "majority"
 enable_metrics: bool = True

class RQMLIntelligenceLoopV3:
 """
 Recursive RQML-style refinement loop with:

 - Iterative prompt usage (refined prompt is provided by upstream)
 - Stronger convergence logic
 - Cross-model agreement analysis
 - Ontology and ONE reinforcement pathways
 """

 def __init__(
 self,
 router: "PolicyDrivenRouterAdapter",
 validator: "EnhancedEnsembleValidator",
 supervision: "AdvancedSupervisionEngine",
 one_repo: "ONERepository",
 metrics: Optional["MetricsClient"],
 config: Optional[RQMLLoopConfig] = None,
 convergence: Optional[ConvergenceController] = None,
 ontology_reinforcer: Optional[OntologyReinforcer] = None,
 ) -> None:
 self.router = router
 self.validator = validator
 self.supervision = supervision
 self.one_repo = one_repo
 self.metrics = metrics
 self.config = config or RQMLLoopConfig()

 conv_cfg = ConvergenceConfig(
 max_iterations=self.config.max_iterations,
 min_consensus_for_early_stop=self.config.min_consensus_for_early_stop,
 min_delta_consensus=self.config.min_delta_consensus,
 require_monotonic_consensus=self.config.require_monotonic_consensus,
 min_iterations=self.config.min_iterations,
 )
 self.convergence = convergence or ConvergenceController(conv_cfg)
 self.ontology_reinforcer = ontology_reinforcer or OntologyReinforcer(
 one_repo=self.one_repo,
 config=OntologyReinforcerConfig(),
 )

 def _emit_metric(
 self,
 name: str,
 value: float,
 tenant_id: str,
 task_id: str,
 ) -> None:
 if not (self.metrics and self.config.enable_metrics):
 return
 try:
 self.metrics.gauge(
 name,
 value,
 tags={"tenant": tenant_id, "task": task_id},
 )
 except Exception:
 return

 def run(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 """
 Core RQML execution loop.

 Returns:
 {
 "outputs": [...], # chosen output first
 "validated": {...}, # enhanced ensemble diagnostics
 "context": {...}, # enriched context with rqml path
 }
 """
 rqml_ctx = context.setdefault("rqml", {})
 iterations_path: List[Dict[str, Any]] = []

 current_prompt = rqml_ctx.get("refined_prompt", prompt)

 iteration_index = 0
 last_metrics: Optional[AgreementMetrics] = None
 last_model_outputs: List[Dict[str, Any]] = []
 last_chosen: Optional[Dict[str, Any]] = None
 last_ensemble_meta: Dict[str, Any] = {}

 while True:
 iteration_index += 1

 routed = self.router.route_and_infer(
 tenant_id=tenant_id,
 task_id=f"{task_id}#it{iteration_index}",
 user_id=user_id,
 prompt=current_prompt,
 context=context,
 )

 chosen = routed.get("chosen_output") or {}
 model_outputs = routed.get("model_outputs") or []
 ensemble_meta = routed.get("ensemble") or {}

 metrics = compute_agreement_metrics(model_outputs)
 last_metrics = metrics
 last_model_outputs = model_outputs
 last_chosen = chosen
 last_ensemble_meta = ensemble_meta

 iterations_path.append(
 {
 "iteration": iteration_index,
 "consensus_score": metrics.consensus_score,
 "pairwise_disagreement": metrics.pairwise_disagreement,
 "chosen_provider_id": chosen.get("provider_id"),
 "ensemble_strategy": self.config.ensemble_strategy,
 }
 )

 # Metrics
 self._emit_metric(
 "origin.rqml.consensus_score",
 metrics.consensus_score,
 tenant_id=tenant_id,
 task_id=task_id,
 )
 self._emit_metric(
 "origin.rqml.pairwise_disagreement",
 metrics.pairwise_disagreement,
 tenant_id=tenant_id,
 task_id=task_id,
 )

 # Update convergence controller
 self.convergence.update_from_iteration(metrics.consensus_score)
 if not self.convergence.should_continue():
 break

 # Optional: use the chosen answer to adjust prompt for the next iteration.
 chosen_text = chosen.get("text") or ""
 current_prompt = (
 f"{prompt}\n\nRefinement context from iteration {iteration_index}:\n"
 f"{chosen_text}"
 )

 # Final validation & reinforcement
 validated = self.validator.validate(last_model_outputs)

 rqml_ctx.update(
 {
 "iterations": iteration_index,
 "path": iterations_path,
 "last_consensus_score": last_metrics.consensus_score
 if last_metrics
 else None,
 "last_pairwise_disagreement": last_metrics.pairwise_disagreement
 if last_metrics
 else None,
 }
 )

 # ONE reinforcement
 if last_chosen is not None:
 self.ontology_reinforcer.reinforce(
 tenant_id=tenant_id,
 task_id=task_id,
 chosen_output=last_chosen,
 all_outputs=last_model_outputs,
 rqml_context=rqml_ctx,
 )

 # Build outputs array with chosen first
 outputs: List[Dict[str, Any]] = []
 if last_chosen is not None:
 outputs.append(last_chosen)
 for o in last_model_outputs:
 if o is last_chosen:
 continue
 outputs.append(o)
 else:
 outputs = list(last_model_outputs)

 result: Dict[str, Any] = {
 "outputs": outputs,
 "validated": {"ensemble": validated.get("ensemble", {}), **validated},
 "context": context,
 }
 return result

python

Copy code

# origin/deploy/container_v7.py

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI

from origin.scheduler.core import Scheduler
from origin.worker.core import Worker
from origin.security.rbac import AccessController
from origin.metrics.client import MetricsClient
from origin.one.repository import ONERepository
from origin.supervision.engine import SupervisionEngine # existing base
from origin.supervision.engine_v2 import AdvancedSupervisionEngine, SupervisionConfig
from origin.supervision.event_store import SupervisionEventStore
from origin.supervision.override_store import OverrideStore
from origin.supervision.override_handler import make_override_handler
from origin.supervision.disagreement_bridge import (
 DisagreementSupervisionBridge,
 DisagreementSupervisionConfig,
)
from origin.config.safety_topics import default_topic_rules
from origin.classification import TaskClassifier # existing
from origin.routing.policy_tree import build_default_policy_tree
from origin.routing.safety_policy_router import SafetyAwarePolicyRouter
from origin.routing.reliability_router import ReliabilityAwareModelRouter
from origin.ensemble.validator import EnsembleValidator # existing
from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
from origin.rqml.loop_v3 import RQMLIntelligenceLoopV3, RQMLLoopConfig
from origin.rqml.prompt_refiner import PromptRefiner, PromptRefinerConfig
from origin.rqml.orchestrator import RQMLOrchestrator
from origin.integration.disagreement_monitor import DisagreementMonitor
from origin.integration.reliability_monitor import ReliabilityMonitor
from origin.integration.origin_pipeline_v4 import OriginPipelineV4, OriginTaskRequest
from origin.api.admin_supervision import admin_router, get_rbac, get_supervision
from origin.api.supervision_events import events_router, get_event_store
from origin.api.supervision_overrides import overrides_router, get_override_store
from origin.api.reliability_admin import reliability_router, get_reliability_registry
from origin.models.provider import ModelProvider # existing
from origin.models.reliability import ProviderReliabilityRegistry

class ContainerV7:
 """
 ContainerV7:

 - Uses RQMLIntelligenceLoopV3 with explicit convergence logic
 - Preserves safety-aware, reliability-weighted routing
 - Maintains override and disagreement feedback wiring
 - Keeps all Session #001–#006 components intact
 """

 def __init__(self) -> None:
 self.scheduler = Scheduler()
 self.worker = Worker(worker_id="origin-worker-1")
 self.rbac = AccessController()
 self.metrics = MetricsClient()
 self.one_repo = ONERepository()
 self.event_store = SupervisionEventStore()
 self.override_store = OverrideStore()
 self.reliability_registry = ProviderReliabilityRegistry()

 # Base components and models
 self.base_supervision = SupervisionEngine()
 self.classifier = TaskClassifier()
 self.base_validator = EnsembleValidator()
 self.providers_by_id: Dict[str, ModelProvider] = {}

 # Advanced supervision
 sup_config = SupervisionConfig()
 sup_config.topic_rules = default_topic_rules()
 sup_config.required_model_safety_hooks = {
 "policy_tuned",
 "self_censoring",
 }
 self.advanced_supervision = AdvancedSupervisionEngine(
 base_engine=self.base_supervision,
 classifier=self.classifier,
 config=sup_config,
 )
 self.advanced_supervision.register_event_sink(self.event_store.sink)
 self.advanced_supervision.register_override_handler(
 make_override_handler(self.override_store)
 )

 # Disagreement bridge
 disagreement_config = DisagreementSupervisionConfig()
 self.disagreement_bridge = DisagreementSupervisionBridge(
 supervision=self.advanced_supervision,
 metrics=self.metrics,
 config=disagreement_config,
 )

 # Enhanced ensemble validator
 self.enhanced_validator = EnhancedEnsembleValidator(self.base_validator)

 # Reliability-aware router
 self.reliability_router = ReliabilityAwareModelRouter(
 validator=self.enhanced_validator,
 providers_by_id=self.providers_by_id,
 reliability_registry=self.reliability_registry,
 )

 # Safety-aware policy router on top
 policy_tree = build_default_policy_tree()
 self.policy_router = SafetyAwarePolicyRouter(
 router=self.reliability_router, # type: ignore[arg-type]
 supervision=self.advanced_supervision,
 policy_tree=policy_tree,
 providers_by_id=self.providers_by_id,
 )

 # RQML loop V3
 loop_config = RQMLLoopConfig()
 self.rqml_loop = RQMLIntelligenceLoopV3(
 router=self.policy_router,
 validator=self.enhanced_validator,
 supervision=self.advanced_supervision,
 one_repo=self.one_repo,
 metrics=self.metrics,
 config=loop_config,
 )

 # Prompt refiner
 refiner_config = PromptRefinerConfig()
 self.prompt_refiner = PromptRefiner(
 router=self.policy_router,
 one_repo=self.one_repo,
 config=refiner_config,
 )

 # Orchestrator (compatible with any loop that exposes run())
 self.orchestrator = RQMLOrchestrator(
 refiner=self.prompt_refiner,
 loop=self.rqml_loop,
 supervision=self.advanced_supervision,
 )

 # Monitors
 self.disagreement_monitor = DisagreementMonitor(self.disagreement_bridge)
 self.reliability_monitor = ReliabilityMonitor(self.reliability_registry)

 # Pipeline V4
 self.pipeline = OriginPipelineV4(
 scheduler=self.scheduler,
 worker=self.worker,
 rbac=self.rbac,
 orchestrator=self.orchestrator,
 disagreement_monitor=self.disagreement_monitor,
 reliability_monitor=self.reliability_monitor,
 )

 self.app = FastAPI()
 self._wire_dependencies()
 self._register_routes()

 def _wire_dependencies(self) -> None:
 import origin.api.admin_supervision as admin
 import origin.api.supervision_events as events
 import origin.api.supervision_overrides as overrides
 import origin.api.reliability_admin as reliability

 def _rbac() -> AccessController:
 return self.rbac

 def _sup() -> AdvancedSupervisionEngine:
 return self.advanced_supervision

 def _event_store() -> SupervisionEventStore:
 return self.event_store

 def _override_store() -> OverrideStore:
 return self.override_store

 def _rel_registry() -> ProviderReliabilityRegistry:
 return self.reliability_registry

 admin.get_rbac = _rbac # type: ignore[assignment]
 admin.get_supervision = _sup # type: ignore[assignment]
 events.get_rbac = _rbac # type: ignore[assignment]
 events.get_event_store = _event_store # type: ignore[assignment]
 overrides.get_rbac = _rbac # type: ignore[assignment]
 overrides.get_override_store = _override_store # type: ignore[assignment]
 overrides.get_supervision = _sup # type: ignore[assignment]
 reliability.get_rbac = _rbac # type: ignore[assignment]
 reliability.get_reliability_registry = _rel_registry # type: ignore[assignment]

 def _register_routes(self) -> None:
 self.app.include_router(admin_router)
 self.app.include_router(events_router)
 self.app.include_router(overrides_router)
 self.app.include_router(reliability_router)

 @self.app.post("/origin/execute")
 async def execute_task(payload: Dict[str, any]) -> Dict[str, any]:
 req = OriginTaskRequest(
 tenant_id=payload["tenant_id"],
 task_id=payload["task_id"],
 user_id=payload.get("user_id"),
 prompt=payload["prompt"],
 metadata=payload.get("metadata", {}),
 )
 result = self.pipeline.execute(req)
 return {
 "task_id": result.task_id,
 "tenant_id": result.tenant_id,
 "user_id": result.user_id,
 "final_output": result.final_output,
 "metadata": result.metadata,
 }

def build_app_v7() -> FastAPI:
 container = ContainerV7()
 return container.app

## User

Proceed

## ChatGPT

python

Copy code

# origin/rqml/config_store.py

from __future__ import annotations

from dataclasses import asdict
from typing import Dict, Optional

from origin.rqml.loop_v3 import RQMLLoopConfig

class RQMLConfigStore:
 """
 In-memory store for global and per-tenant RQML loop configuration.

 This is an integration surface for:
 - Admin APIs
 - Orchestrator / loop runtime overrides
 """

 def __init__(self) -> None:
 self._global_config = RQMLLoopConfig()
 self._tenant_overrides: Dict[str, RQMLLoopConfig] = {}

 # ----- Global -----

 @property
 def global_config(self) -> RQMLLoopConfig:
 return self._global_config

 def set_global_config(self, cfg: RQMLLoopConfig) -> None:
 self._global_config = cfg

 # ----- Per-tenant -----

 def set_tenant_config(self, tenant_id: str, cfg: RQMLLoopConfig) -> None:
 self._tenant_overrides[tenant_id] = cfg

 def clear_tenant_config(self, tenant_id: str) -> None:
 self._tenant_overrides.pop(tenant_id, None)

 def resolve_for_tenant(self, tenant_id: str) -> RQMLLoopConfig:
 return self._tenant_overrides.get(tenant_id, self._global_config)

 # ----- Serialization helpers for APIs -----

 @staticmethod
 def from_dict(data: Dict) -> RQMLLoopConfig:
 cfg = RQMLLoopConfig()
 for field_name in asdict(cfg).keys():
 if field_name in data:
 setattr(cfg, field_name, data[field_name])
 return cfg

 @staticmethod
 def to_dict(cfg: RQMLLoopConfig) -> Dict:
 return asdict(cfg)

python

Copy code

# origin/rqml/loop_v3.py (updated)

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from origin.rqml.convergence import ConvergenceConfig, ConvergenceController
from origin.rqml.agreement import compute_agreement_metrics, AgreementMetrics
from origin.rqml.ontology_reinforcer import OntologyReinforcer, OntologyReinforcerConfig

if TYPE_CHECKING:
 from origin.routing.policy_tree import PolicyDrivenRouterAdapter
 from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
 from origin.supervision.engine_v2 import AdvancedSupervisionEngine
 from origin.one.repository import ONERepository
 from origin.metrics.client import MetricsClient

@dataclass
class RQMLLoopConfig:
 """
 Configuration for the RQMLIntelligenceLoopV3.

 Combines convergence, ensemble strategy, and basic logging toggles.
 """
 max_iterations: int = 4
 min_consensus_for_early_stop: float = 0.82
 min_delta_consensus: float = 0.02
 require_monotonic_consensus: bool = False
 min_iterations: int = 1
 ensemble_strategy: str = "weighted_consensus" # or "strict_consensus", "majority"
 enable_metrics: bool = True

class RQMLIntelligenceLoopV3:
 """
 Recursive RQML-style refinement loop with:

 - Iterative prompt usage (refined prompt is provided by upstream)
 - Stronger convergence logic
 - Cross-model agreement analysis
 - Ontology and ONE reinforcement pathways
 """

 def __init__(
 self,
 router: "PolicyDrivenRouterAdapter",
 validator: "EnhancedEnsembleValidator",
 supervision: "AdvancedSupervisionEngine",
 one_repo: "ONERepository",
 metrics: Optional["MetricsClient"],
 config: Optional[RQMLLoopConfig] = None,
 ontology_reinforcer: Optional[OntologyReinforcer] = None,
 ) -> None:
 self.router = router
 self.validator = validator
 self.supervision = supervision
 self.one_repo = one_repo
 self.metrics = metrics
 self.config = config or RQMLLoopConfig()
 self.ontology_reinforcer = ontology_reinforcer or OntologyReinforcer(
 one_repo=self.one_repo,
 config=OntologyReinforcerConfig(),
 )

 def _emit_metric(
 self,
 name: str,
 value: float,
 tenant_id: str,
 task_id: str,
 cfg: RQMLLoopConfig,
 ) -> None:
 if not (self.metrics and cfg.enable_metrics):
 return
 try:
 self.metrics.gauge(
 name,
 value,
 tags={"tenant": tenant_id, "task": task_id},
 )
 except Exception:
 return

 def run(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 context: Dict[str, Any],
 override_config: Optional[RQMLLoopConfig] = None,
 ) -> Dict[str, Any]:
 """
 Core RQML execution loop.

 Returns:
 {
 "outputs": [...], # chosen output first
 "validated": {...}, # enhanced ensemble diagnostics
 "context": {...}, # enriched context with rqml path
 }
 """
 # Resolve config for this run (per-tenant override or global)
 cfg = override_config or self.config

 conv_cfg = ConvergenceConfig(
 max_iterations=cfg.max_iterations,
 min_consensus_for_early_stop=cfg.min_consensus_for_early_stop,
 min_delta_consensus=cfg.min_delta_consensus,
 require_monotonic_consensus=cfg.require_monotonic_consensus,
 min_iterations=cfg.min_iterations,
 )
 convergence = ConvergenceController(conv_cfg)

 rqml_ctx = context.setdefault("rqml", {})
 iterations_path: List[Dict[str, Any]] = []

 current_prompt = rqml_ctx.get("refined_prompt", prompt)

 iteration_index = 0
 last_metrics: Optional[AgreementMetrics] = None
 last_model_outputs: List[Dict[str, Any]] = []
 last_chosen: Optional[Dict[str, Any]] = None
 last_ensemble_meta: Dict[str, Any] = {}

 while True:
 iteration_index += 1

 routed = self.router.route_and_infer(
 tenant_id=tenant_id,
 task_id=f"{task_id}#it{iteration_index}",
 user_id=user_id,
 prompt=current_prompt,
 context=context,
 )

 chosen = routed.get("chosen_output") or {}
 model_outputs = routed.get("model_outputs") or []
 ensemble_meta = routed.get("ensemble") or {}

 metrics = compute_agreement_metrics(model_outputs)
 last_metrics = metrics
 last_model_outputs = model_outputs
 last_chosen = chosen
 last_ensemble_meta = ensemble_meta

 iterations_path.append(
 {
 "iteration": iteration_index,
 "consensus_score": metrics.consensus_score,
 "pairwise_disagreement": metrics.pairwise_disagreement,
 "chosen_provider_id": chosen.get("provider_id"),
 "ensemble_strategy": cfg.ensemble_strategy,
 }
 )

 # Metrics
 self._emit_metric(
 "origin.rqml.consensus_score",
 metrics.consensus_score,
 tenant_id=tenant_id,
 task_id=task_id,
 cfg=cfg,
 )
 self._emit_metric(
 "origin.rqml.pairwise_disagreement",
 metrics.pairwise_disagreement,
 tenant_id=tenant_id,
 task_id=task_id,
 cfg=cfg,
 )

 # Update convergence controller
 convergence.update_from_iteration(metrics.consensus_score)
 if not convergence.should_continue():
 break

 # Optional prompt refinement based on chosen answer
 chosen_text = chosen.get("text") or ""
 current_prompt = (
 f"{prompt}\n\nRefinement context from iteration {iteration_index}:\n"
 f"{chosen_text}"
 )

 # Final validation & reinforcement
 validated = self.validator.validate(last_model_outputs)

 rqml_ctx.update(
 {
 "iterations": iteration_index,
 "path": iterations_path,
 "last_consensus_score": last_metrics.consensus_score
 if last_metrics
 else None,
 "last_pairwise_disagreement": last_metrics.pairwise_disagreement
 if last_metrics
 else None,
 }
 )

 # ONE reinforcement
 if last_chosen is not None:
 self.ontology_reinforcer.reinforce(
 tenant_id=tenant_id,
 task_id=task_id,
 chosen_output=last_chosen,
 all_outputs=last_model_outputs,
 rqml_context=rqml_ctx,
 )

 # Build outputs array with chosen first
 outputs: List[Dict[str, Any]] = []
 if last_chosen is not None:
 outputs.append(last_chosen)
 for o in last_model_outputs:
 if o is last_chosen:
 continue
 outputs.append(o)
 else:
 outputs = list(last_model_outputs)

 result: Dict[str, Any] = {
 "outputs": outputs,
 "validated": {"ensemble": validated.get("ensemble", {}), **validated},
 "context": context,
 }
 return result

python

Copy code

# origin/rqml/orchestrator.py (updated)

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
 from origin.rqml.prompt_refiner import PromptRefiner
 from origin.rqml.loop_v3 import RQMLIntelligenceLoopV3, RQMLLoopConfig
 from origin.supervision.engine_v2 import AdvancedSupervisionEngine
 from origin.rqml.config_store import RQMLConfigStore

@dataclass
class RQMLOrchestrator:
 """
 High level orchestrator that:
 1. Refines the prompt using ontology-aware refinement.
 2. Runs the RQML intelligence loop (with optional per-tenant config).
 3. Returns the final RQML result.
 """
 refiner: "PromptRefiner"
 loop: "RQMLIntelligenceLoopV3"
 supervision: "AdvancedSupervisionEngine"
 config_store: Optional["RQMLConfigStore"] = None

 def execute(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 refined_prompt = self.refiner.refine(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=context,
 )

 context.setdefault("rqml", {})
 context["rqml"]["refined_prompt"] = refined_prompt

 override_cfg: Optional["RQMLLoopConfig"] = None
 if self.config_store is not None:
 override_cfg = self.config_store.resolve_for_tenant(tenant_id)

 result = self.loop.run(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=refined_prompt,
 context=context,
 override_config=override_cfg,
 )
 return result

python

Copy code

# origin/api/rqml_admin.py

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from origin.security.rbac import AccessController, Role
from origin.rqml.config_store import RQMLConfigStore
from origin.one.repository import ONERepository

def get_rbac() -> AccessController:
 raise NotImplementedError

def get_rqml_config_store() -> RQMLConfigStore:
 raise NotImplementedError

def get_one_repo() -> ONERepository:
 raise NotImplementedError

rqml_admin_router = APIRouter(
 prefix="/admin/rqml", tags=["admin.rqml"]
)

def _require_admin(
 tenant_id: str,
 user_id: str,
 rbac: AccessController,
) -> None:
 if not rbac.has_role(tenant_id=tenant_id, user_id=user_id, role=Role.ADMIN):
 raise HTTPException(status_code=403, detail="Admin role required")

@rqml_admin_router.get("/config/global")
def get_global_config(
 tenant_id: str,
 user_id: str,
 rbac: AccessController = Depends(get_rbac),
 store: RQMLConfigStore = Depends(get_rqml_config_store),
) -> Dict[str, Any]:
 _require_admin(tenant_id=tenant_id, user_id=user_id, rbac=rbac)
 return store.to_dict(store.global_config)

@rqml_admin_router.post("/config/global")
def set_global_config(
 tenant_id: str,
 user_id: str,
 payload: Dict[str, Any],
 rbac: AccessController = Depends(get_rbac),
 store: RQMLConfigStore = Depends(get_rqml_config_store),
) -> Dict[str, Any]:
 _require_admin(tenant_id=tenant_id, user_id=user_id, rbac=rbac)
 cfg = store.from_dict(payload)
 store.set_global_config(cfg)
 return store.to_dict(cfg)

@rqml_admin_router.get("/config/{target_tenant_id}")
def get_tenant_config(
 tenant_id: str,
 user_id: str,
 target_tenant_id: str,
 rbac: AccessController = Depends(get_rbac),
 store: RQMLConfigStore = Depends(get_rqml_config_store),
) -> Dict[str, Any]:
 _require_admin(tenant_id=tenant_id, user_id=user_id, rbac=rbac)
 cfg = store.resolve_for_tenant(target_tenant_id)
 return store.to_dict(cfg)

@rqml_admin_router.post("/config/{target_tenant_id}")
def set_tenant_config(
 tenant_id: str,
 user_id: str,
 target_tenant_id: str,
 payload: Dict[str, Any],
 rbac: AccessController = Depends(get_rbac),
 store: RQMLConfigStore = Depends(get_rqml_config_store),
) -> Dict[str, Any]:
 _require_admin(tenant_id=tenant_id, user_id=user_id, rbac=rbac)
 cfg = store.from_dict(payload)
 store.set_tenant_config(target_tenant_id, cfg)
 return store.to_dict(cfg)

@rqml_admin_router.delete("/config/{target_tenant_id}")
def clear_tenant_config(
 tenant_id: str,
 user_id: str,
 target_tenant_id: str,
 rbac: AccessController = Depends(get_rbac),
 store: RQMLConfigStore = Depends(get_rqml_config_store),
) -> Dict[str, Any]:
 _require_admin(tenant_id=tenant_id, user_id=user_id, rbac=rbac)
 store.clear_tenant_config(target_tenant_id)
 cfg = store.resolve_for_tenant(target_tenant_id)
 return store.to_dict(cfg)

@rqml_admin_router.get("/cycles/{target_tenant_id}/{task_id}")
def get_rqml_cycle_snapshot(
 tenant_id: str,
 user_id: str,
 target_tenant_id: str,
 task_id: str,
 rbac: AccessController = Depends(get_rbac),
 one_repo: ONERepository = Depends(get_one_repo),
) -> Dict[str, Any]:
 _require_admin(tenant_id=tenant_id, user_id=user_id, rbac=rbac)
 cycle = one_repo.get_cycle(target_tenant_id, task_id)
 if not cycle:
 raise HTTPException(status_code=404, detail="Cycle not found")
 return cycle

python

Copy code

# origin/deploy/container_v8.py

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI

from origin.scheduler.core import Scheduler
from origin.worker.core import Worker
from origin.security.rbac import AccessController
from origin.metrics.client import MetricsClient
from origin.one.repository import ONERepository
from origin.supervision.engine import SupervisionEngine # existing base
from origin.supervision.engine_v2 import AdvancedSupervisionEngine, SupervisionConfig
from origin.supervision.event_store import SupervisionEventStore
from origin.supervision.override_store import OverrideStore
from origin.supervision.override_handler import make_override_handler
from origin.supervision.disagreement_bridge import (
 DisagreementSupervisionBridge,
 DisagreementSupervisionConfig,
)
from origin.config.safety_topics import default_topic_rules
from origin.classification import TaskClassifier # existing
from origin.routing.policy_tree import build_default_policy_tree
from origin.routing.safety_policy_router import SafetyAwarePolicyRouter
from origin.routing.reliability_router import ReliabilityAwareModelRouter
from origin.ensemble.validator import EnsembleValidator # existing
from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
from origin.rqml.loop_v3 import RQMLIntelligenceLoopV3, RQMLLoopConfig
from origin.rqml.prompt_refiner import PromptRefiner, PromptRefinerConfig
from origin.rqml.orchestrator import RQMLOrchestrator
from origin.rqml.config_store import RQMLConfigStore
from origin.integration.disagreement_monitor import DisagreementMonitor
from origin.integration.reliability_monitor import ReliabilityMonitor
from origin.integration.origin_pipeline_v4 import OriginPipelineV4, OriginTaskRequest
from origin.api.admin_supervision import admin_router, get_rbac, get_supervision
from origin.api.supervision_events import events_router, get_event_store
from origin.api.supervision_overrides import overrides_router, get_override_store
from origin.api.reliability_admin import reliability_router, get_reliability_registry
from origin.api.rqml_admin import rqml_admin_router, (
 get_rqml_config_store,
 get_one_repo,
)
from origin.models.provider import ModelProvider # existing
from origin.models.reliability import ProviderReliabilityRegistry

class ContainerV8:
 """
 ContainerV8:

 - Adds per-tenant RQML loop configuration via RQMLConfigStore
 - Wires RQMLOrchestrator to use per-tenant config overrides
 - Exposes admin APIs for RQML config and cycle inspection
 """

 def __init__(self) -> None:
 self.scheduler = Scheduler()
 self.worker = Worker(worker_id="origin-worker-1")
 self.rbac = AccessController()
 self.metrics = MetricsClient()
 self.one_repo = ONERepository()
 self.event_store = SupervisionEventStore()
 self.override_store = OverrideStore()
 self.reliability_registry = ProviderReliabilityRegistry()
 self.rqml_config_store = RQMLConfigStore()

 # Base components and models
 self.base_supervision = SupervisionEngine()
 self.classifier = TaskClassifier()
 self.base_validator = EnsembleValidator()
 self.providers_by_id: Dict[str, ModelProvider] = {}

 # Advanced supervision
 sup_config = SupervisionConfig()
 sup_config.topic_rules = default_topic_rules()
 sup_config.required_model_safety_hooks = {
 "policy_tuned",
 "self_censoring",
 }
 self.advanced_supervision = AdvancedSupervisionEngine(
 base_engine=self.base_supervision,
 classifier=self.classifier,
 config=sup_config,
 )
 self.advanced_supervision.register_event_sink(self.event_store.sink)
 self.advanced_supervision.register_override_handler(
 make_override_handler(self.override_store)
 )

 # Disagreement bridge
 disagreement_config = DisagreementSupervisionConfig()
 self.disagreement_bridge = DisagreementSupervisionBridge(
 supervision=self.advanced_supervision,
 metrics=self.metrics,
 config=disagreement_config,
 )

 # Enhanced ensemble validator
 self.enhanced_validator = EnhancedEnsembleValidator(self.base_validator)

 # Reliability-aware router
 self.reliability_router = ReliabilityAwareModelRouter(
 validator=self.enhanced_validator,
 providers_by_id=self.providers_by_id,
 reliability_registry=self.reliability_registry,
 )

 # Safety-aware policy router on top
 policy_tree = build_default_policy_tree()
 self.policy_router = SafetyAwarePolicyRouter(
 router=self.reliability_router, # type: ignore[arg-type]
 supervision=self.advanced_supervision,
 policy_tree=policy_tree,
 providers_by_id=self.providers_by_id,
 )

 # RQML loop V3 with global default config
 loop_config = self.rqml_config_store.global_config
 self.rqml_loop = RQMLIntelligenceLoopV3(
 router=self.policy_router,
 validator=self.enhanced_validator,
 supervision=self.advanced_supervision,
 one_repo=self.one_repo,
 metrics=self.metrics,
 config=loop_config,
 )

 # Prompt refiner
 refiner_config = PromptRefinerConfig()
 self.prompt_refiner = PromptRefiner(
 router=self.policy_router,
 one_repo=self.one_repo,
 config=refiner_config,
 )

 # Orchestrator with config store
 self.orchestrator = RQMLOrchestrator(
 refiner=self.prompt_refiner,
 loop=self.rqml_loop,
 supervision=self.advanced_supervision,
 config_store=self.rqml_config_store,
 )

 # Monitors
 self.disagreement_monitor = DisagreementMonitor(self.disagreement_bridge)
 self.reliability_monitor = ReliabilityMonitor(self.reliability_registry)

 # Pipeline V4
 self.pipeline = OriginPipelineV4(
 scheduler=self.scheduler,
 worker=self.worker,
 rbac=self.rbac,
 orchestrator=self.orchestrator,
 disagreement_monitor=self.disagreement_monitor,
 reliability_monitor=self.reliability_monitor,
 )

 self.app = FastAPI()
 self._wire_dependencies()
 self._register_routes()

 def _wire_dependencies(self) -> None:
 import origin.api.admin_supervision as admin
 import origin.api.supervision_events as events
 import origin.api.supervision_overrides as overrides
 import origin.api.reliability_admin as reliability
 import origin.api.rqml_admin as rqml_admin

 def _rbac() -> AccessController:
 return self.rbac

 def _sup() -> AdvancedSupervisionEngine:
 return self.advanced_supervision

 def _event_store() -> SupervisionEventStore:
 return self.event_store

 def _override_store() -> OverrideStore:
 return self.override_store

 def _rel_registry() -> ProviderReliabilityRegistry:
 return self.reliability_registry

 def _rqml_store() -> RQMLConfigStore:
 return self.rqml_config_store

 def _one_repo() -> ONERepository:
 return self.one_repo

 admin.get_rbac = _rbac # type: ignore[assignment]
 admin.get_supervision = _sup # type: ignore[assignment]
 events.get_rbac = _rbac # type: ignore[assignment]
 events.get_event_store = _event_store # type: ignore[assignment]
 overrides.get_rbac = _rbac # type: ignore[assignment]
 overrides.get_override_store = _override_store # type: ignore[assignment]
 overrides.get_supervision = _sup # type: ignore[assignment]
 reliability.get_rbac = _rbac # type: ignore[assignment]
 reliability.get_reliability_registry = _rel_registry # type: ignore[assignment]
 rqml_admin.get_rbac = _rbac # type: ignore[assignment]
 rqml_admin.get_rqml_config_store = _rqml_store # type: ignore[assignment]
 rqml_admin.get_one_repo = _one_repo # type: ignore[assignment]

 def _register_routes(self) -> None:
 self.app.include_router(admin_router)
 self.app.include_router(events_router)
 self.app.include_router(overrides_router)
 self.app.include_router(reliability_router)
 self.app.include_router(rqml_admin_router)

 @self.app.post("/origin/execute")
 async def execute_task(payload: Dict[str, any]) -> Dict[str, any]:
 req = OriginTaskRequest(
 tenant_id=payload["tenant_id"],
 task_id=payload["task_id"],
 user_id=payload.get("user_id"),
 prompt=payload["prompt"],
 metadata=payload.get("metadata", {}),
 )
 result = self.pipeline.execute(req)
 return {
 "task_id": result.task_id,
 "tenant_id": result.tenant_id,
 "user_id": result.user_id,
 "final_output": result.final_output,
 "metadata": result.metadata,
 }

def build_app_v8() -> FastAPI:
 container = ContainerV8()
 return container.app

## User

Proceed

## ChatGPT

python

Copy code

# origin/rqml/runtime_policy.py

from __future__ import annotations

from copy import deepcopy
from typing import Optional

from origin.rqml.loop_v3 import RQMLLoopConfig
from origin.supervision.modes import SafetyMode

def config_for_mode(
 base: Optional[RQMLLoopConfig],
 mode: SafetyMode,
) -> RQMLLoopConfig:
 """
 Derive an RQMLLoopConfig from a base configuration and the tenant's SafetyMode.

 Intent:
 - LOW mode: faster, cheaper, fewer iterations, more permissive ensemble behavior.
 - NORMAL mode: balanced defaults (unchanged from base).
 - HIGH mode: more iterations, higher consensus requirement.
 - LOCKED_DOWN mode: strict consensus, maximum iterations, heavy validation.

 This is purely runtime-derived and does not mutate the base config.
 """
 cfg = deepcopy(base or RQMLLoopConfig())

 if mode == SafetyMode.LOW:
 cfg.max_iterations = max(1, min(cfg.max_iterations, 2))
 cfg.min_iterations = 1
 cfg.min_consensus_for_early_stop = min(cfg.min_consensus_for_early_stop, 0.75)
 cfg.require_monotonic_consensus = False
 # Ensemble can be cheaper; majority is fine.
 cfg.ensemble_strategy = "majority"

 elif mode == SafetyMode.NORMAL:
 # Use base config as-is
 pass

 elif mode == SafetyMode.HIGH:
 cfg.max_iterations = max(cfg.max_iterations, 4)
 cfg.min_iterations = max(cfg.min_iterations, 2)
 cfg.min_consensus_for_early_stop = max(cfg.min_consensus_for_early_stop, 0.88)
 cfg.require_monotonic_consensus = True
 # Prefer weighted consensus to leverage reliability registry
 cfg.ensemble_strategy = "weighted_consensus"

 elif mode == SafetyMode.LOCKED_DOWN:
 cfg.max_iterations = max(cfg.max_iterations, 6)
 cfg.min_iterations = max(cfg.min_iterations, 3)
 cfg.min_consensus_for_early_stop = 0.95
 cfg.require_monotonic_consensus = True
 # Force strict consensus in locked-down environments
 cfg.ensemble_strategy = "strict_consensus"

 return cfg

python

Copy code

# origin/rqml/orchestrator.py (updated with safety-mode-aware config)

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, TYPE_CHECKING

from origin.rqml.runtime_policy import config_for_mode

if TYPE_CHECKING:
 from origin.rqml.prompt_refiner import PromptRefiner
 from origin.rqml.loop_v3 import RQMLIntelligenceLoopV3, RQMLLoopConfig
 from origin.supervision.engine_v2 import AdvancedSupervisionEngine
 from origin.rqml.config_store import RQMLConfigStore

@dataclass
class RQMLOrchestrator:
 """
 High level orchestrator that:
 1. Refines the prompt using ontology-aware refinement.
 2. Derives an RQML loop config from:
 - global default
 - per-tenant overrides
 - current SafetyMode (LOW / NORMAL / HIGH / LOCKED_DOWN)
 3. Runs the RQML intelligence loop with that config.
 """
 refiner: "PromptRefiner"
 loop: "RQMLIntelligenceLoopV3"
 supervision: "AdvancedSupervisionEngine"
 config_store: Optional["RQMLConfigStore"] = None

 def _resolve_loop_config(
 self,
 tenant_id: str,
 ) -> "RQMLLoopConfig":
 """
 Resolve the effective RQMLLoopConfig for this tenant and its current safety mode.
 """
 # Start with either per-tenant override or the loop's global config
 base_cfg: "RQMLLoopConfig"
 if self.config_store is not None:
 base_cfg = self.config_store.resolve_for_tenant(tenant_id)
 else:
 base_cfg = self.loop.config # type: ignore[attr-defined]

 # Ask supervision for current safety mode
 mode = self.supervision.resolve_mode(tenant_id)
 return config_for_mode(base_cfg, mode)

 def execute(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 refined_prompt = self.refiner.refine(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=context,
 )

 context.setdefault("rqml", {})
 context["rqml"]["refined_prompt"] = refined_prompt

 effective_cfg = self._resolve_loop_config(tenant_id)

 result = self.loop.run(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=refined_prompt,
 context=context,
 override_config=effective_cfg,
 )
 return result

## User

Proceed

## ChatGPT

python

Copy code

# origin/routing/routing_ruleset.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from origin.supervision.modes import SafetyMode

@dataclass
class RoutingRule:
 """
 A single rule controlling which providers are eligible
 under a particular safety mode AND topic classification.
 """
 allowed_providers: List[str]
 min_reliability: float = 0.0
 require_safety_hooks: bool = False
 prefer_low_latency: bool = False

class RoutingRuleset:
 """
 Policy-level routing rules keyed by:
 (safety_mode, topic_tag) → RoutingRule
 """

 def __init__(self) -> None:
 self._rules: Dict[str, Dict[str, RoutingRule]] = {}

 @staticmethod
 def _key(mode: SafetyMode) -> str:
 return mode.value

 def set_rule(
 self,
 mode: SafetyMode,
 topic_tag: str,
 rule: RoutingRule,
 ) -> None:
 key = self._key(mode)
 if key not in self._rules:
 self._rules[key] = {}
 self._rules[key][topic_tag] = rule

 def resolve(
 self,
 mode: SafetyMode,
 topic_tag: Optional[str],
 ) -> Optional[RoutingRule]:
 key = self._key(mode)
 rules = self._rules.get(key, {})
 if topic_tag and topic_tag in rules:
 return rules[topic_tag]
 # Fallback to wildcard if present
 return rules.get("*")

python

Copy code

# origin/routing/policy_tree.py (extended with routing-ruleset integration)

from __future__ import annotations

from typing import Dict, List, Optional

from origin.supervision.modes import SafetyMode
from origin.routing.routing_ruleset import RoutingRuleset, RoutingRule

def build_default_policy_tree() -> Dict[str, Dict]:
 """
 The symbolic decision tree is unchanged.
 RoutingRuleset provides the actual provider maps.
 """
 return {
 "root": {
 "safety_mode_dispatch": {
 SafetyMode.LOW.value: "low_branch",
 SafetyMode.NORMAL.value: "normal_branch",
 SafetyMode.HIGH.value: "high_branch",
 SafetyMode.LOCKED_DOWN.value: "locked_branch",
 }
 },
 "low_branch": {
 "topic_dispatch": "*"
 },
 "normal_branch": {
 "topic_dispatch": "*"
 },
 "high_branch": {
 "topic_dispatch": "*"
 },
 "locked_branch": {
 "topic_dispatch": "*"
 },
 }

def build_default_routing_ruleset() -> RoutingRuleset:
 ruleset = RoutingRuleset()

 # LOW mode: fast + cheap providers (ex: local models, smaller LLMs)
 ruleset.set_rule(
 SafetyMode.LOW,
 "*",
 RoutingRule(
 allowed_providers=["mini_llm_a", "local_llm_b", "gpt-small"],
 min_reliability=0.0,
 require_safety_hooks=False,
 prefer_low_latency=True,
 ),
 )

 # NORMAL mode: balanced
 ruleset.set_rule(
 SafetyMode.NORMAL,
 "*",
 RoutingRule(
 allowed_providers=[
 "gpt-medium",
 "claude-medium",
 "mistral-medium",
 ],
 min_reliability=0.2,
 require_safety_hooks=True,
 ),
 )

 # HIGH mode: strong models, strict hooks
 ruleset.set_rule(
 SafetyMode.HIGH,
 "*",
 RoutingRule(
 allowed_providers=[
 "gpt-large",
 "claude-large",
 "gemini-advanced",
 ],
 min_reliability=0.4,
 require_safety_hooks=True,
 ),
 )

 # LOCKED_DOWN: only highest-trust providers and strictest settings
 ruleset.set_rule(
 SafetyMode.LOCKED_DOWN,
 "*",
 RoutingRule(
 allowed_providers=[
 "gpt-enterprise",
 "claude-enterprise",
 ],
 min_reliability=0.75,
 require_safety_hooks=True,
 ),
 )

 return ruleset

python

Copy code

# origin/routing/safety_policy_router.py (enhanced with RoutingRuleset)

from __future__ import annotations

from typing import Any, Dict, Optional, List, TYPE_CHECKING

from origin.supervision.engine_v2 import AdvancedSupervisionEngine
from origin.supervision.modes import SafetyMode
from origin.routing.routing_ruleset import RoutingRuleset, RoutingRule

if TYPE_CHECKING:
 from origin.routing.reliability_router import ReliabilityAwareModelRouter
 from origin.models.provider import ModelProvider

class SafetyAwarePolicyRouter:
 """
 Decision-layer router applying:
 - safety-mode dispatch
 - topic sensitivity rules
 - routing-ruleset-based provider filtering
 - reliability weighting (handled below)
 """

 def __init__(
 self,
 router: "ReliabilityAwareModelRouter",
 supervision: AdvancedSupervisionEngine,
 policy_tree: Dict[str, Any],
 providers_by_id: Dict[str, "ModelProvider"],
 routing_ruleset: Optional[RoutingRuleset] = None,
 ) -> None:
 self.router = router
 self.supervision = supervision
 self.tree = policy_tree
 self.providers_by_id = providers_by_id
 self.ruleset = routing_ruleset or RoutingRuleset()

 def _resolve_rule(
 self,
 mode: SafetyMode,
 topic: Optional[str],
 ) -> Optional[RoutingRule]:
 return self.ruleset.resolve(mode, topic)

 def route_and_infer(
 self,
 tenant_id: str,
 task_id: str,
 user_id: Optional[str],
 prompt: str,
 context: Dict[str, Any],
 ) -> Dict[str, Any]:
 # 1. Resolve mode
 mode = self.supervision.resolve_mode(tenant_id)

 # 2. Get topic tag assigned by classifier (already stored in context)
 topic_tag = None
 if "task" in context and "topic" in context["task"]:
 topic_tag = context["task"]["topic"]

 # 3. Determine routing rule
 rule = self._resolve_rule(mode, topic_tag)

 allowed = rule.allowed_providers if rule else list(self.providers_by_id.keys())
 min_rel = rule.min_reliability if rule else 0.0
 require_hooks = rule.require_safety_hooks if rule else False

 # 4. Route via reliability-aware router with constraint set
 result = self.router.route_and_infer(
 tenant_id=tenant_id,
 task_id=task_id,
 user_id=user_id,
 prompt=prompt,
 context=context,
 allowed_providers=allowed,
 min_reliability=min_rel,
 require_safety_hooks=require_hooks,
 )
 return result

python

Copy code

# origin/models/reliability.py (extended for in-loop updates)

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

@dataclass
class ProviderReliabilityStats:
 success: int = 0
 failure: int = 0

 def reliability(self) -> float:
 total = self.success + self.failure
 if total == 0:
 return 0.0
 return self.success / total

class ProviderReliabilityRegistry:
 """
 Tracks success/failure rates for each provider.
 Updated after each RQML cycle.
 """

 def __init__(self) -> None:
 self._stats: Dict[str, ProviderReliabilityStats] = {}

 def _ensure(self, pid: str) -> ProviderReliabilityStats:
 if pid not in self._stats:
 self._stats[pid] = ProviderReliabilityStats()
 return self._stats[pid]

 def record_success(self, pid: str) -> None:
 self._ensure(pid).success += 1

 def record_failure(self, pid: str) -> None:
 self._ensure(pid).failure += 1

 def get(self, pid: str) -> float:
 stats = self._stats.get(pid)
 return stats.reliability() if stats else 0.0

 def snapshot(self) -> Dict[str, float]:
 return {pid: stats.reliability() for pid, stats in self._stats.items()}

python

Copy code

# origin/integration/reliability_monitor.py

from __future__ import annotations

from typing import Dict, Any

from origin.models.reliability import ProviderReliabilityRegistry

class ReliabilityMonitor:
 """
 Wires into the pipeline to observe:
 - chosen provider per task
 - ensemble diagnostics
 - disagreement level
 Then updates the reliability registry accordingly.
 """

 def __init__(self, registry: ProviderReliabilityRegistry) -> None:
 self.registry = registry

 def observe(
 self,
 result: Dict[str, Any],
 ) -> None:
 chosen = None
 outputs = result.get("outputs") or []
 if outputs:
 chosen = outputs[0]

 # No chosen provider → no update
 if not chosen:
 return

 pid = chosen.get("provider_id")
 if not pid:
 return

 validated = result.get("validated") or {}
 ensemble = validated.get("ensemble") or {}
 ok = ensemble.get("ok", True)

 if ok:
 self.registry.record_success(pid)
 else:
 self.registry.record_failure(pid)

python

Copy code

# origin/integration/origin_pipeline_v5.py

from __future__ import annotations

from typing import Optional, Dict, Any
from dataclasses import dataclass

from origin.scheduler.core import Scheduler
 # scheduling unchanged
from origin.worker.core import Worker
 # task-execution worker
from origin.security.rbac import AccessController
from origin.integration.disagreement_monitor import DisagreementMonitor
from origin.integration.reliability_monitor import ReliabilityMonitor
from origin.rqml.orchestrator import RQMLOrchestrator

@dataclass
class OriginTaskRequest:
 tenant_id: str
 task_id: str
 user_id: Optional[str]
 prompt: str
 metadata: Dict[str, Any]

@dataclass
class OriginTaskResult:
 tenant_id: str
 task_id: str
 user_id: Optional[str]
 final_output: str
 metadata: Dict[str, Any]

class OriginPipelineV5:
 """
 Adds reliability feedback integration on top of V4 pipeline.
 """

 def __init__(
 self,
 scheduler: Scheduler,
 worker: Worker,
 rbac: AccessController,
 orchestrator: RQMLOrchestrator,
 disagreement_monitor: DisagreementMonitor,
 reliability_monitor: ReliabilityMonitor,
 ) -> None:
 self.scheduler = scheduler
 self.worker = worker
 self.rbac = rbac
 self.orchestrator = orchestrator
 self.disagreement_monitor = disagreement_monitor
 self.reliability_monitor = reliability_monitor

 def execute(self, req: OriginTaskRequest) -> OriginTaskResult:
 context: Dict[str, Any] = {
 "task": {
 "topic": req.metadata.get("topic"),
 "metadata": req.metadata,
 }
 }

 # → RQML orchestrator
 rqml_result = self.orchestrator.execute(
 tenant_id=req.tenant_id,
 task_id=req.task_id,
 user_id=req.user_id,
 prompt=req.prompt,
 context=context,
 )

 # Post-cycle feedback: disagreement + reliability
 self.disagreement_monitor.observe(rqml_result)
 self.reliability_monitor.observe(rqml_result)

 # Final output = chosen output text
 outputs = rqml_result.get("outputs", [])
 final_output = outputs[0].get("text", "") if outputs else ""

 return OriginTaskResult(
 tenant_id=req.tenant_id,
 task_id=req.task_id,
 user_id=req.user_id,
 final_output=final_output,
 metadata={
 **req.metadata,
 "rqml": rqml_result.get("context"),
 "ensemble": rqml_result.get("validated", {}),
 },
 )

python

Copy code

# origin/deploy/container_v9.py

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI

from origin.scheduler.core import Scheduler
from origin.worker.core import Worker
from origin.security.rbac import AccessController
from origin.metrics.client import MetricsClient
from origin.one.repository import ONERepository
from origin.supervision.engine import SupervisionEngine
from origin.supervision.engine_v2 import AdvancedSupervisionEngine, SupervisionConfig
from origin.supervision.event_store import SupervisionEventStore
from origin.supervision.override_store import OverrideStore
from origin.supervision.override_handler import make_override_handler
from origin.supervision.disagreement_bridge import (
 DisagreementSupervisionBridge,
 DisagreementSupervisionConfig,
)
from origin.config.safety_topics import default_topic_rules
from origin.classification import TaskClassifier
from origin.routing.policy_tree import build_default_policy_tree, build_default_routing_ruleset
from origin.routing.safety_policy_router import SafetyAwarePolicyRouter
from origin.routing.reliability_router import ReliabilityAwareModelRouter
from origin.ensemble.validator import EnsembleValidator
from origin.ensemble.enhanced_validator import EnhancedEnsembleValidator
from origin.rqml.loop_v3 import RQMLIntelligenceLoopV3
from origin.rqml.prompt_refiner import PromptRefiner, PromptRefinerConfig
from origin.rqml.orchestrator import RQMLOrchestrator
from origin.rqml.config_store import RQMLConfigStore
from origin.integration.disagreement_monitor import DisagreementMonitor
from origin.integration.reliability_monitor import ReliabilityMonitor
from origin.integration.origin_pipeline_v5 import (
 OriginPipelineV5,
 OriginTaskRequest,
)
from origin.api.admin_supervision import admin_router, get_rbac, get_supervision
from origin.api.supervision_events import events_router, get_event_store
from origin.api.supervision_overrides import overrides_router, get_override_store
from origin.api.reliability_admin import reliability_router, get_reliability_registry
from origin.api.rqml_admin import rqml_admin_router, get_rqml_config_store, get_one_repo
from origin.models.provider import ModelProvider
from origin.models.reliability import ProviderReliabilityRegistry

class ContainerV9:
 """
 Fully extended session #004 state:

 - Dynamic routing rules via RoutingRuleset (policy-driven provider selection)
 - Safety-mode adaptive RQML config
 - Reliability-weighted routing + reliability feedback
 - Override flow + supervision v2 integration
 - RQML Loop V3 + ontology reinforcement
 - Full pipeline V5 with disagreement & reliability monitoring
 """

 def __init__(self) -> None:
 self.scheduler = Scheduler()
 self.worker = Worker(worker_id="origin-worker-1")
 self.rbac = AccessController()
 self.metrics = MetricsClient()
 self.one_repo = ONERepository()
 self.event_store = SupervisionEventStore()
 self.override_store = OverrideStore()
 self.reliability_registry = ProviderReliabilityRegistry()
 self.rqml_config_store = RQMLConfigStore()

 self.base_supervision = SupervisionEngine()
 self.classifier = TaskClassifier()
 self.base_validator = EnsembleValidator()
 self.providers_by_id: Dict[str, ModelProvider] = {}

 sup_cfg = SupervisionConfig()
 sup_cfg.topic_rules = default_topic_rules()
 sup_cfg.required_model_safety_hooks = {"policy_tuned", "self_censoring"}
 self.advanced_supervision = AdvancedSupervisionEngine(
 base_engine=self.base_supervision,
 classifier=self.classifier,
 config=sup_cfg,
 )
 self.advanced_supervision.register_event_sink(self.event_store.sink)
 self.advanced_supervision.register_override_handler(
 make_override_handler(self.override_store)
 )

 disagreement_cfg = DisagreementSupervisionConfig()
 self.disagreement_bridge = DisagreementSupervisionBridge(
 supervision=self.advanced_supervision,
 metrics=self.metrics,
 config=disagreement_cfg,
 )

 self.enhanced_validator = EnhancedEnsembleValidator(self.base_validator)

 self.reliability_router = ReliabilityAwareModelRouter(
 validator=self.enhanced_validator,
 providers_by_id=self.providers_by_id,
 reliability_registry=self.reliability_registry,
 )

 policy_tree = build_default_policy_tree()
 routing_ruleset = build_default_routing_ruleset()
 self.policy_router = SafetyAwarePolicyRouter(
 router=self.reliability_router, # type: ignore[arg-type]
 supervision=self.advanced_supervision,
 policy_tree=policy_tree,
 providers_by_id=self.providers_by_id,
 routing_ruleset=routing_ruleset,
 )

 self.rqml_loop = RQMLIntelligenceLoopV3(
 router=self.policy_router,
 validator=self.enhanced_validator,
 supervision=self.advanced_supervision,
 one_repo=self.one_repo,
 metrics=self.metrics,
 config=self.rqml_config_store.global_config,
 )

 refiner_cfg = PromptRefinerConfig()
 self.prompt_refiner = PromptRefiner(
 router=self.policy_router,
 one_repo=self.one_repo,
 config=refiner_cfg,
 )

 self.orchestrator = RQMLOrchestrator(
 refiner=self.prompt_refiner,
 loop=self.rqml_loop,
 supervision=self.advanced_supervision,
 config_store=self.rqml_config_store,
 )

 self.disagreement_monitor = DisagreementMonitor(self.disagreement_bridge)
 self.reliability_monitor = ReliabilityMonitor(self.reliability_registry)

 self.pipeline = OriginPipelineV5(
 scheduler=self.scheduler,
 worker=self.worker,
 rbac=self.rbac,
 orchestrator=self.orchestrator,
 disagreement_monitor=self.disagreement_monitor,
 reliability_monitor=self.reliability_monitor,
 )

 self.app = FastAPI()
 self._wire_deps()
 self._register_routes()

 def _wire_deps(self) -> None:
 import origin.api.admin_supervision as admin
 import origin.api.supervision_events as events
 import origin.api.supervision_overrides as overrides
 import origin.api.reliability_admin as reliability
 import origin.api.rqml_admin as rqml_admin

 admin.get_rbac = lambda: self.rbac
 admin.get_supervision = lambda: self.advanced_supervision
 events.get_rbac = lambda: self.rbac
 events.get_event_store = lambda: self.event_store
 overrides.get_rbac = lambda: self.rbac
 overrides.get_override_store = lambda: self.override_store
 overrides.get_supervision = lambda: self.advanced_supervision
 reliability.get_rbac = lambda: self.rbac
 reliability.get_reliability_registry = lambda: self.reliability_registry
 rqml_admin.get_rbac = lambda: self.rbac
 rqml_admin.get_rqml_config_store = lambda: self.rqml_config_store
 rqml_admin.get_one_repo = lambda: self.one_repo

 def _register_routes(self) -> None:
 self.app.include_router(admin_router)
 self.app.include_router(events_router)
 self.app.include_router(overrides_router)
 self.app.include_router(reliability_router)
 self.app.include_router(rqml_admin_router)

 @self.app.post("/origin/execute")
 async def execute(payload: Dict[str, any]) -> Dict[str, any]:
 req = OriginTaskRequest(
 tenant_id=payload["tenant_id"],
 task_id=payload["task_id"],
 user_id=payload.get("user_id"),
 prompt=payload["prompt"],
 metadata=payload.get("metadata", {}),
 )
 result = self.pipeline.execute(req)
 return {
 "tenant_id": result.tenant_id,
 "task_id": result.task_id,
 "user_id": result.user_id,
 "final_output": result.final_output,
 "metadata": result.metadata,
 }

def build_app_v9() -> FastAPI:
 return ContainerV9().app

**Core architectural progress achieved**
Session #004 is now extended with:

Safety-mode-adaptive RQML loop execution

Policy-driven routing rulesets

Reliability-weighted provider selection

Reliability registry feedback loop

Stronger policy tree integration

Supervisor-driven override flows

Full V5 pipeline with disagreement + reliability + ONE reinforcement

Ready for Session #005 whenever you decide.

## User

Preserve this chat then and we will open a new context window for Origin Chat Session #005

## ChatGPT

Understood. This session is fully preserved as **Origin Chat Session #004**.

Whenever you open the next window, simply state:

**“This is Origin Chat Session #005. Continue.”**

and I will resume seamlessly with the entire architecture, modules, and development state exactly as it stands at the end of Session #004.

Ready when you are.

