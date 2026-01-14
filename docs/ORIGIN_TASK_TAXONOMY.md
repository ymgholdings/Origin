# ORIGIN Task Taxonomy

This taxonomy standardizes how ORIGIN Conductor classifies work, assigns the right model/tools, and enforces acceptance criteria. Each task type includes: intent, typical inputs/outputs, and a definition of done.

## 1) Architecture and System Design
**Intent:** Define or refine system structure, module boundaries, interfaces, runtime contracts.

**Inputs**
- Existing repo structure and specs
- Target constraints (performance, security, portability)

**Outputs**
- Updated architecture docs (diagrams optional)
- Interface contracts, module boundaries, dependency rules
- ADRs (architecture decision records) when decisions are non-trivial

**Done when**
- Interfaces are explicit and testable
- Decisions are recorded with rationale and tradeoffs
- No ambiguity about module ownership and data flow

## 2) Aureon / RQML Dataset Lifecycle
**Intent:** Generate, refine, validate, and lock datasets (Dn → Dn+k′) with traceable invariants.

**Subtasks**
- Dataset synthesis (generate)
- Consistency audit (audit)
- Refinement loop (refine)
- Cross-model validation (validate)
- Convergence check (converge)
- Lock/seal (lock)

**Outputs**
- Dataset manifest (scope, primitives, operators, assumptions)
- Validation matrix (what was checked, by whom, how)
- Convergence report (metrics, thresholds, stop conditions)
- Lock certificate (fingerprints, version tag)

**Done when**
- Dataset is either explicitly “in-flight” or explicitly “locked”
- Lock includes a deterministic fingerprint and reproducible manifest
- Any unresolved uncertainties are documented as next tasks

## 3) Simulation and Stress Testing
**Intent:** Probe stability envelopes, failure modes, and parameter sensitivities without changing primitives.

**Subtasks**
- Parameter sweep
- Resolution sensitivity analysis
- Coupled envelope mapping
- Regression tests across known stable regions

**Outputs**
- Simulation report with pass/fail criteria
- Boundary tables and stability regions (“islands/valleys”)
- Recommendations for regularization or model constraints

**Done when**
- Failure modes are classified (numerical vs intrinsic vs mixed)
- Stability boundaries are documented in reproducible terms
- Proposed mitigations are testable

## 4) Formal Methods and Verification
**Intent:** Ensure internal consistency of math/specs and correctness of validators.

**Subtasks**
- DAG/causality validators
- Invariant proofs or proof sketches
- Consistency checks for operator definitions

**Outputs**
- Verified validator logic and tests
- Proof notes (concise and auditable)
- Clear failure criteria

**Done when**
- Validators have unit tests and known counterexamples
- Claims are stated with assumptions and limits

## 5) Code Implementation
**Intent:** Build production-grade modules and tooling.

**Subtasks**
- Feature implementation
- Refactors with behavior preservation
- Performance improvements
- API client integration (OpenAI/Anthropic/Gemini)

**Outputs**
- Code with tests
- Documentation updates
- Backward compatibility notes (if applicable)

**Done when**
- Code is linted/formatted (where configured)
- Tests pass or failures are explained with next actions
- No secrets or credentials are committed

## 6) Code Quality and Standards
**Intent:** Keep the repo maintainable and predictable.

**Subtasks**
- Linting, formatting
- Type checks
- Dependency pinning and upgrades
- Security scanning

**Outputs**
- Config updates (ruff/black/mypy/eslint/prettier/etc.)
- CI updates
- Dependency lock changes

**Done when**
- Tooling runs locally and in CI
- Dependency changes are justified and minimal-risk

## 7) CI/CD and Release Engineering
**Intent:** Make builds reproducible and deployments safe.

**Subtasks**
- GitHub Actions pipelines
- Test matrices
- Versioning and changelogs
- Release packaging

**Outputs**
- CI workflows
- Release notes
- Build artifacts (when configured)

**Done when**
- CI runs on PRs and main
- Failures produce actionable logs
- Releases are versioned and reproducible

## 8) Security, Privacy, and Secrets Handling
**Intent:** Prevent key leakage, unsafe automation, and insecure defaults.

**Subtasks**
- Secret scanning rules
- .env + .gitignore enforcement
- Access control and least privilege
- Threat modeling for orchestrator actions

**Outputs**
- Security policy docs
- Repo guardrails (pre-commit hooks optional)
- Hardening changes

**Done when**
- Secrets are confirmed absent from git history
- Clear instructions exist for key storage and rotation

## 9) Documentation and Knowledge Management
**Intent:** Keep docs aligned with reality.

**Subtasks**
- README updates
- Module docs and runbooks
- Dataset documentation
- Decision logs

**Outputs**
- Updated markdown docs
- Runbooks for setup and operation

**Done when**
- A new contributor can run the system from scratch
- Docs match actual commands and configuration

## 10) Repository Operations
**Intent:** Keep changes reviewable and auditable.

**Subtasks**
- Branching strategy
- PR assembly
- Commit messages
- File organization and naming

**Outputs**
- Clean diffs, small commits, clear PR descriptions

**Done when**
- Work is isolated to a branch
- Commits explain intent
- PR is ready for review and merge
