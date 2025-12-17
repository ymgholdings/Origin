# ORIGIN Multi-Agent Coordination MCP Server

A Model Context Protocol (MCP) server for coordinating the five-agent ORIGIN development system.

## Overview

This MCP server enables seamless communication and coordination between multiple AI agents working together to develop and deploy the ORIGIN system. The server implements a sophisticated workflow management system with task routing, artifact storage, validation pipelines, and inter-agent messaging.

## Agent Architecture

The system coordinates six specialized AI agents:

1. **ChatGPT GPT-5.2** - Program Manager & Orchestrator
   - Role: Overall project management and coordination
   - Responsibilities: Task delegation, workflow orchestration, escalation management

2. **Gemini 3** - Multimodal Research & Contextual Reasoning
   - Role: Research and information gathering
   - Capabilities: 1M token context window, multimodal analysis
   - Phase: `intake_research`

3. **Gemini GEM** - Origin Tech Curation & Segmentation
   - Role: Lossless curation of technical content
   - Responsibilities: Document segmentation, LaTeX conversion, notation preservation
   - Phase: `conversion_preparation`

4. **Grok 4** - Advanced Reasoning & Safety Cross-Check
   - Role: Safety validation and correctness verification
   - Responsibilities: Safety analysis, ethical review, risk assessment
   - Phase: `validation_safety`

5. **DeepSeek V3.2** - Complex Reasoning & Problem-Solving
   - Role: Mathematical reasoning and algorithmic correctness
   - Capabilities: Gold-level competitive programming, formal verification
   - Phase: `reasoning_analysis`

6. **Claude Sonnet 4.5** - Full-Stack Implementation & Integration
   - Role: Code implementation and system integration
   - Responsibilities: Development, testing, deployment
   - Phase: `implementation`, `deployment`

## Workflow Phases

The system progresses through six distinct phases:

```
intake_research → conversion_preparation → reasoning_analysis →
implementation → validation_safety → deployment
```

Each phase has specific requirements that must be met before advancing to the next phase.

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

Add the MCP server to your Claude configuration:

```json
{
  "mcpServers": {
    "origin-coordination": {
      "command": "node",
      "args": ["/path/to/Origin/mcp-server/dist/index.js"]
    }
  }
}
```

## Available Tools

### Task Management

#### `create_task`
Create a new task in the system.

**Parameters:**
- `title` (string): Task title
- `description` (string): Detailed description
- `phase` (string): Workflow phase (`intake_research`, `conversion_preparation`, etc.)
- `priority` (string, optional): Priority level (`low`, `medium`, `high`, `critical`)
- `createdBy` (string, optional): Agent creating the task
- `dependencies` (string[], optional): Task IDs this task depends on
- `metadata` (object, optional): Additional metadata

**Example:**
```json
{
  "title": "Research quantum error correction methods",
  "description": "Comprehensive research on current QECC techniques",
  "phase": "intake_research",
  "priority": "high",
  "createdBy": "chatgpt_moderator"
}
```

#### `route_task`
Route a task to the appropriate agent based on phase and context.

**Parameters:**
- `taskId` (string): ID of task to route
- `context` (string, optional): Additional context for routing decision

**Returns:**
- `taskId`: The routed task ID
- `assignedTo`: Agent type assigned
- `reasoning`: Explanation of routing decision

#### `update_task_status`
Update the status of a task.

**Parameters:**
- `taskId` (string): Task ID
- `status` (string): New status (`pending`, `in_progress`, `completed`, `blocked`, etc.)
- `notes` (string, optional): Status update notes

#### `get_task`
Retrieve a specific task by ID.

**Parameters:**
- `taskId` (string): Task ID

#### `list_tasks`
List tasks with optional filtering.

**Parameters:**
- `status` (string, optional): Filter by status
- `assignedTo` (string, optional): Filter by assigned agent
- `phase` (string, optional): Filter by workflow phase

### Artifact Management

#### `submit_artifact`
Submit a work artifact (research, code, documentation, etc.).

**Parameters:**
- `taskId` (string): Associated task ID
- `artifactType` (string): Type of artifact (`raw_session`, `curated_segment`, `research_brief`, `latex_document`, `reasoning_report`, `implementation_code`, `validation_report`, `deployment_artifact`)
- `name` (string): Artifact name
- `description` (string): Description
- `content` (string): Artifact content
- `createdBy` (string): Agent creating the artifact
- `metadata` (object, optional): Additional metadata

**Example:**
```json
{
  "taskId": "task_123",
  "artifactType": "research_brief",
  "name": "QECC Research Summary",
  "description": "Comprehensive analysis of quantum error correction methods",
  "content": "# Quantum Error Correction\n\n...",
  "createdBy": "gemini3_research"
}
```

#### `get_artifact`
Retrieve a specific artifact by ID.

**Parameters:**
- `artifactId` (string): Artifact ID

#### `list_artifacts`
List artifacts with optional filtering.

**Parameters:**
- `artifactType` (string, optional): Filter by type
- `createdBy` (string, optional): Filter by creator agent

### Validation Workflows

#### `request_validation`
Request validation for an artifact.

**Parameters:**
- `artifactId` (string): Artifact to validate
- `validationType` (string): Type of validation (`safety`, `correctness`, `quality`, `completeness`)
- `validatorAgent` (string): Agent to perform validation
- `requestedBy` (string): Agent requesting validation
- `criteria` (string, optional): Specific validation criteria

**Example:**
```json
{
  "artifactId": "artifact_456",
  "validationType": "safety",
  "validatorAgent": "grok4_safety",
  "requestedBy": "claude_builder",
  "criteria": "Check for potential security vulnerabilities and ethical concerns"
}
```

#### `submit_validation_result`
Submit the result of a validation.

**Parameters:**
- `validationId` (string): Validation request ID
- `approved` (boolean): Whether the artifact is approved
- `feedback` (string): Detailed feedback
- `suggestions` (string, optional): Suggestions for improvement

#### `get_validation_status`
Check the status of a validation request.

**Parameters:**
- `validationId` (string): Validation request ID

### Agent Communication

#### `send_message`
Send a message to another agent.

**Parameters:**
- `from` (string): Sender agent type
- `to` (string): Recipient agent type
- `subject` (string): Message subject
- `content` (string): Message content
- `priority` (string, optional): Priority (`low`, `normal`, `high`, `urgent`)
- `relatedTaskId` (string, optional): Related task ID
- `relatedArtifactId` (string, optional): Related artifact ID

**Example:**
```json
{
  "from": "claude_builder",
  "to": "grok4_safety",
  "subject": "Ready for safety review",
  "content": "Implementation complete. Please review artifact artifact_789 for safety concerns.",
  "priority": "high",
  "relatedArtifactId": "artifact_789"
}
```

#### `get_messages`
Retrieve messages for an agent.

**Parameters:**
- `agent` (string): Agent type
- `unreadOnly` (boolean, optional): Only return unread messages

### Escalations

#### `escalate_issue`
Escalate an issue to the moderator.

**Parameters:**
- `raisedBy` (string): Agent raising the escalation
- `issue` (string): Brief issue description
- `context` (string): Detailed context
- `severity` (string): Severity level (`low`, `medium`, `high`, `critical`)
- `suggestedAction` (string, optional): Suggested resolution
- `relatedTaskId` (string, optional): Related task
- `relatedArtifactId` (string, optional): Related artifact

**Example:**
```json
{
  "raisedBy": "deepseek_reasoning",
  "issue": "Mathematical proof contains logical flaw",
  "context": "The proof in artifact_999 assumes a property that hasn't been established",
  "severity": "high",
  "suggestedAction": "Request revised proof from research team",
  "relatedArtifactId": "artifact_999"
}
```

#### `resolve_escalation`
Resolve an escalation.

**Parameters:**
- `escalationId` (string): Escalation ID
- `resolution` (string): Resolution description
- `resolvedBy` (string): Agent resolving the escalation

### Project State

#### `get_project_state`
Get comprehensive project state information.

**Returns:**
- `currentPhase`: Current workflow phase
- `phaseHistory`: History of phase transitions
- `tasks`: Task statistics (total, by status, by phase)
- `artifacts`: Artifact statistics (total, by type)
- `validations`: Validation statistics (total, pending, approved, rejected)
- `escalations`: Escalation statistics (total, active, by severity)
- `agentStatuses`: Current status of all agents
- `phaseProgress`: Percentage completion of current phase
- `lastUpdated`: Last update timestamp

#### `update_agent_status`
Update an agent's status.

**Parameters:**
- `agent` (string): Agent type
- `status` (string): Status description
- `details` (string, optional): Additional details

### Workflow Control

#### `advance_phase`
Advance to the next workflow phase.

**Parameters:**
- `nextPhase` (string): Target workflow phase
- `justification` (string): Reason for phase advancement
- `initiatedBy` (string): Agent initiating the transition

**Returns:**
- `success`: Whether the transition succeeded
- `currentPhase`: New current phase
- `message`: Result message

**Phase Transition Rules:**
- Can only advance one phase forward or backward
- Must meet current phase requirements before advancing
- All agents are notified of phase transitions

## Workflow Examples

### Example 1: Research to Implementation Pipeline

```javascript
// 1. Moderator creates research task
create_task({
  title: "Research RQML quantum algorithms",
  description: "Investigate state-of-the-art quantum algorithms for RQML",
  phase: "intake_research",
  priority: "high"
})

// 2. Route to research agent
route_task({
  taskId: "task_001",
  context: "Initial research phase"
})
// Returns: { assignedTo: "gemini3_research" }

// 3. Research agent submits findings
submit_artifact({
  taskId: "task_001",
  artifactType: "research_brief",
  name: "RQML Algorithm Analysis",
  content: "...",
  createdBy: "gemini3_research"
})

// 4. Advance to curation phase
advance_phase({
  nextPhase: "conversion_preparation",
  justification: "Research complete with comprehensive findings",
  initiatedBy: "chatgpt_moderator"
})

// 5. GEM curator segments and converts
submit_artifact({
  taskId: "task_002",
  artifactType: "latex_document",
  name: "RQML Segmented Analysis",
  content: "\\documentclass{article}...",
  createdBy: "gemini_gem_curator"
})

// 6. DeepSeek performs reasoning analysis
advance_phase({
  nextPhase: "reasoning_analysis",
  justification: "Curation complete with LaTeX conversion",
  initiatedBy: "chatgpt_moderator"
})

// 7. Claude implements the solution
advance_phase({
  nextPhase: "implementation",
  justification: "Reasoning validated with formal proofs",
  initiatedBy: "chatgpt_moderator"
})

submit_artifact({
  taskId: "task_003",
  artifactType: "implementation_code",
  name: "RQML Implementation",
  content: "class RQMLAlgorithm { ... }",
  createdBy: "claude_builder"
})

// 8. Grok validates safety
request_validation({
  artifactId: "artifact_003",
  validationType: "safety",
  validatorAgent: "grok4_safety",
  requestedBy: "claude_builder"
})

// 9. Deploy to production
advance_phase({
  nextPhase: "deployment",
  justification: "Safety validation passed",
  initiatedBy: "chatgpt_moderator"
})
```

### Example 2: Escalation Workflow

```javascript
// Agent encounters blocking issue
escalate_issue({
  raisedBy: "claude_builder",
  issue: "API rate limits preventing deployment",
  context: "Cannot complete deployment due to external API rate limiting",
  severity: "high",
  suggestedAction: "Request increased API quota or implement caching layer"
})

// Moderator reviews and resolves
resolve_escalation({
  escalationId: "escalation_001",
  resolution: "Implemented local caching layer to reduce API calls",
  resolvedBy: "chatgpt_moderator"
})
```

## Architecture

### Storage Layer (`storage.ts`)
In-memory data storage for all project entities:
- Tasks
- Artifacts
- Validation requests
- Messages
- Escalations
- Agent statuses

### Coordination Layer (`coordination.ts`)
Manages agent coordination:
- Task creation and routing
- Artifact submission and linking
- Inter-agent messaging
- Escalation management
- Agent status tracking

### Workflow Layer (`workflow.ts`)
Manages workflow state and transitions:
- Validation request handling
- Phase transition logic
- Phase requirement checking
- Project state aggregation
- Workflow recommendations

## Development

### Building
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Watch Mode
```bash
npm run watch
```

## Type Definitions

All types are defined in `src/types.ts`:

- `AgentType`: The six agent types
- `TaskStatus`: Task lifecycle states
- `WorkflowPhase`: Six workflow phases
- `ArtifactType`: Eight artifact types
- `Task`: Task entity structure
- `Artifact`: Artifact entity structure
- `ValidationRequest`: Validation request structure
- `Message`: Inter-agent message structure
- `Escalation`: Escalation entity structure
- `ProjectState`: Aggregated project state

## Best Practices

1. **Task Creation**: Always specify appropriate phase and priority
2. **Routing**: Let the system auto-route based on phase, or provide context for manual routing
3. **Artifacts**: Link all artifacts to tasks for traceability
4. **Validation**: Request validation before phase transitions
5. **Communication**: Use messages for coordination, escalations for blockers
6. **Phase Advancement**: Ensure all requirements are met before advancing
7. **Agent Status**: Keep agent status updated for better coordination

## License

MIT

## Authors

ORIGIN Development Team
