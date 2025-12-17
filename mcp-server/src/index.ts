#!/usr/bin/env node

/**
 * ORIGIN Multi-Agent Coordination MCP Server
 *
 * This MCP server coordinates the five-agent ORIGIN development system:
 * - ChatGPT GPT-5.2: Program Manager & Orchestrator
 * - Gemini 3: Multimodal Research & Contextual Reasoning
 * - Gemini GEM: Origin Tech Curation & Segmentation
 * - Grok 4: Advanced Reasoning & Safety Cross-Check
 * - DeepSeek V3.2: Complex Reasoning & Problem-Solving
 * - Claude Sonnet 4.5: Full-Stack Implementation & Integration
 *
 * Provides tools for:
 * - Task creation and routing
 * - Artifact storage and retrieval
 * - Validation workflows
 * - Agent communication
 * - Project state management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { CoordinationManager } from './coordination.js';
import { WorkflowManager } from './workflow.js';
import { StorageManager } from './storage.js';
import {
  AgentType,
  WorkflowPhase,
  TaskStatus,
  ArtifactType,
} from './types.js';

// Initialize managers
const storage = new StorageManager();
const coordination = new CoordinationManager(storage);
const workflow = new WorkflowManager(storage, coordination);

// Define MCP tools
const tools: Tool[] = [
  // === TASK MANAGEMENT ===
  {
    name: 'create_task',
    description:
      'Create a new task in the ORIGIN development workflow. Used by ChatGPT Moderator to create and assign tasks to appropriate agents.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Brief title of the task',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what needs to be done',
        },
        phase: {
          type: 'string',
          enum: [
            'intake_research',
            'conversion_preparation',
            'reasoning_analysis',
            'implementation',
            'validation_safety',
            'deployment',
          ],
          description: 'Which workflow phase this task belongs to',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Task priority level',
        },
        assignTo: {
          type: 'string',
          enum: [
            'chatgpt_moderator',
            'gemini3_research',
            'gemini_gem_curator',
            'grok4_safety',
            'deepseek_reasoning',
            'claude_builder',
          ],
          description: 'Agent to assign this task to',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of tasks that must complete first',
        },
        metadata: {
          type: 'object',
          description: 'Additional task-specific metadata',
        },
      },
      required: ['title', 'description', 'phase', 'priority'],
    },
  },

  {
    name: 'route_task',
    description:
      'Route a task to the appropriate agent based on complexity, content type, and agent capabilities. Primary tool for ChatGPT Moderator.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to route',
        },
        targetAgent: {
          type: 'string',
          enum: [
            'chatgpt_moderator',
            'gemini3_research',
            'gemini_gem_curator',
            'grok4_safety',
            'deepseek_reasoning',
            'claude_builder',
          ],
          description: 'Agent to route the task to',
        },
        reason: {
          type: 'string',
          description: 'Explanation of why this agent was chosen',
        },
        instructions: {
          type: 'string',
          description: 'Specific instructions for the assigned agent',
        },
        deadline: {
          type: 'string',
          description: 'Optional deadline (ISO 8601 format)',
        },
      },
      required: ['taskId', 'targetAgent', 'reason', 'instructions'],
    },
  },

  {
    name: 'update_task_status',
    description:
      'Update the status of a task as it progresses through the workflow. Used by agents to report progress.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to update',
        },
        status: {
          type: 'string',
          enum: [
            'pending',
            'routed',
            'in_progress',
            'review',
            'approved',
            'rejected',
            'completed',
            'blocked',
          ],
          description: 'New status of the task',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the status change',
        },
      },
      required: ['taskId', 'status'],
    },
  },

  {
    name: 'get_task',
    description: 'Retrieve details of a specific task by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to retrieve',
        },
      },
      required: ['taskId'],
    },
  },

  {
    name: 'list_tasks',
    description:
      'List tasks based on filters. Use to see assigned tasks, pending work, or track project progress.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: [
            'pending',
            'routed',
            'in_progress',
            'review',
            'approved',
            'rejected',
            'completed',
            'blocked',
          ],
          description: 'Filter by task status',
        },
        assignedTo: {
          type: 'string',
          enum: [
            'chatgpt_moderator',
            'gemini3_research',
            'gemini_gem_curator',
            'grok4_safety',
            'deepseek_reasoning',
            'claude_builder',
          ],
          description: 'Filter by assigned agent',
        },
        phase: {
          type: 'string',
          enum: [
            'intake_research',
            'conversion_preparation',
            'reasoning_analysis',
            'implementation',
            'validation_safety',
            'deployment',
          ],
          description: 'Filter by workflow phase',
        },
      },
    },
  },

  // === ARTIFACT MANAGEMENT ===
  {
    name: 'submit_artifact',
    description:
      'Submit a work product (artifact) for a task. Used by agents to deliver their work for review or handoff to next agent.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task this artifact belongs to',
        },
        artifactType: {
          type: 'string',
          enum: [
            'raw_session',
            'curated_segment',
            'research_brief',
            'latex_document',
            'reasoning_report',
            'implementation_code',
            'validation_report',
            'deployment_artifact',
          ],
          description: 'Type of artifact being submitted',
        },
        name: {
          type: 'string',
          description: 'Name/title of the artifact',
        },
        description: {
          type: 'string',
          description: 'Brief description of the artifact',
        },
        content: {
          type: 'string',
          description:
            'The actual artifact content (file path, URL, or inline content)',
        },
        requiresValidation: {
          type: 'boolean',
          description: 'Whether this artifact requires validation before use',
        },
        validationType: {
          type: 'string',
          enum: ['safety', 'correctness', 'quality', 'completeness'],
          description: 'Type of validation required (if any)',
        },
        metadata: {
          type: 'object',
          description: 'Additional artifact metadata (source, version, etc.)',
        },
      },
      required: [
        'taskId',
        'artifactType',
        'name',
        'description',
        'content',
        'requiresValidation',
      ],
    },
  },

  {
    name: 'get_artifact',
    description: 'Retrieve a specific artifact by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        artifactId: {
          type: 'string',
          description: 'ID of the artifact to retrieve',
        },
      },
      required: ['artifactId'],
    },
  },

  {
    name: 'list_artifacts',
    description:
      'List artifacts based on filters. Use to find work products from specific agents or tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Filter by task ID',
        },
        artifactType: {
          type: 'string',
          enum: [
            'raw_session',
            'curated_segment',
            'research_brief',
            'latex_document',
            'reasoning_report',
            'implementation_code',
            'validation_report',
            'deployment_artifact',
          ],
          description: 'Filter by artifact type',
        },
        createdBy: {
          type: 'string',
          enum: [
            'chatgpt_moderator',
            'gemini3_research',
            'gemini_gem_curator',
            'grok4_safety',
            'deepseek_reasoning',
            'claude_builder',
          ],
          description: 'Filter by creating agent',
        },
      },
    },
  },

  // === VALIDATION WORKFLOWS ===
  {
    name: 'request_validation',
    description:
      'Request validation of an artifact. Used to invoke Grok 4 for safety checks or DeepSeek for correctness validation.',
    inputSchema: {
      type: 'object',
      properties: {
        artifactId: {
          type: 'string',
          description: 'ID of the artifact to validate',
        },
        validationType: {
          type: 'string',
          enum: ['safety', 'correctness', 'quality', 'completeness'],
          description: 'Type of validation needed',
        },
        validatorAgent: {
          type: 'string',
          enum: ['grok4_safety', 'deepseek_reasoning', 'chatgpt_moderator'],
          description: 'Agent to perform the validation',
        },
        instructions: {
          type: 'string',
          description: 'Specific validation instructions or concerns',
        },
      },
      required: ['artifactId', 'validationType', 'validatorAgent'],
    },
  },

  {
    name: 'submit_validation_result',
    description:
      'Submit the result of a validation. Used by validator agents (Grok 4, DeepSeek) to report findings.',
    inputSchema: {
      type: 'object',
      properties: {
        validationId: {
          type: 'string',
          description: 'ID of the validation request',
        },
        approved: {
          type: 'boolean',
          description: 'Whether the artifact passed validation',
        },
        findings: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of issues or observations found',
        },
        recommendations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recommended actions or improvements',
        },
        report: {
          type: 'string',
          description: 'Full validation report',
        },
      },
      required: ['validationId', 'approved', 'findings', 'report'],
    },
  },

  {
    name: 'get_validation_status',
    description: 'Check the status of a validation request.',
    inputSchema: {
      type: 'object',
      properties: {
        validationId: {
          type: 'string',
          description: 'ID of the validation request',
        },
      },
      required: ['validationId'],
    },
  },

  // === AGENT COMMUNICATION ===
  {
    name: 'send_message',
    description:
      'Send a message to another agent or broadcast to all agents. Used for coordination and clarification requests.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description:
            'Target agent (use "all" for broadcast) - chatgpt_moderator, gemini3_research, gemini_gem_curator, grok4_safety, deepseek_reasoning, claude_builder, or all',
        },
        type: {
          type: 'string',
          enum: ['request', 'response', 'notification', 'escalation'],
          description: 'Type of message',
        },
        subject: {
          type: 'string',
          description: 'Message subject line',
        },
        content: {
          type: 'string',
          description: 'Message content',
        },
        taskId: {
          type: 'string',
          description: 'Related task ID (if applicable)',
        },
        artifactId: {
          type: 'string',
          description: 'Related artifact ID (if applicable)',
        },
        requiresResponse: {
          type: 'boolean',
          description: 'Whether a response is required',
        },
      },
      required: ['to', 'type', 'subject', 'content', 'requiresResponse'],
    },
  },

  {
    name: 'get_messages',
    description:
      'Retrieve messages sent to current agent. Use to check for pending requests or notifications.',
    inputSchema: {
      type: 'object',
      properties: {
        unreadOnly: {
          type: 'boolean',
          description: 'Only return unread messages',
        },
        type: {
          type: 'string',
          enum: ['request', 'response', 'notification', 'escalation'],
          description: 'Filter by message type',
        },
      },
    },
  },

  // === ESCALATIONS ===
  {
    name: 'escalate_issue',
    description:
      'Escalate an issue to the ChatGPT Moderator. Use when blocked, encountering errors, or needing guidance.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the related task',
        },
        reason: {
          type: 'string',
          description: 'Explanation of the issue',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Severity of the issue',
        },
        suggestedAction: {
          type: 'string',
          description: 'Suggested course of action (if any)',
        },
      },
      required: ['taskId', 'reason', 'severity'],
    },
  },

  {
    name: 'resolve_escalation',
    description:
      'Resolve an escalated issue. Used by ChatGPT Moderator to provide guidance and close escalations.',
    inputSchema: {
      type: 'object',
      properties: {
        escalationId: {
          type: 'string',
          description: 'ID of the escalation to resolve',
        },
        resolution: {
          type: 'string',
          description: 'Explanation of the resolution',
        },
        actions: {
          type: 'string',
          description: 'Actions taken or instructions provided',
        },
      },
      required: ['escalationId', 'resolution'],
    },
  },

  // === PROJECT STATE ===
  {
    name: 'get_project_state',
    description:
      'Get current state of the ORIGIN project including active tasks, completed work, and agent statuses.',
    inputSchema: {
      type: 'object',
      properties: {
        includeCompleted: {
          type: 'boolean',
          description: 'Include completed tasks in response',
        },
        includeArtifacts: {
          type: 'boolean',
          description: 'Include artifact list in response',
        },
      },
    },
  },

  {
    name: 'update_agent_status',
    description:
      'Update current agent status (available, busy, offline). Used to coordinate workload.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['available', 'busy', 'offline'],
          description: 'New agent status',
        },
        statusMessage: {
          type: 'string',
          description: 'Optional status message',
        },
      },
      required: ['status'],
    },
  },

  // === WORKFLOW CONTROL ===
  {
    name: 'advance_phase',
    description:
      'Advance the project to the next workflow phase. Used by ChatGPT Moderator when a phase is complete.',
    inputSchema: {
      type: 'object',
      properties: {
        currentPhase: {
          type: 'string',
          enum: [
            'intake_research',
            'conversion_preparation',
            'reasoning_analysis',
            'implementation',
            'validation_safety',
            'deployment',
          ],
          description: 'Current phase to advance from',
        },
        confirmation: {
          type: 'boolean',
          description: 'Confirmation that phase is complete',
        },
      },
      required: ['currentPhase', 'confirmation'],
    },
  },
];

// Initialize MCP server
const server = new Server(
  {
    name: 'origin-coordination-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // === TASK MANAGEMENT ===
      case 'create_task': {
        const input = args as {
          title: string;
          description: string;
          phase: string;
          priority?: string;
          createdBy?: string;
          dependencies?: string[];
          metadata?: Record<string, unknown>;
        };
        const task = coordination.createTask({
          title: input.title,
          description: input.description,
          phase: input.phase as WorkflowPhase,
          priority: (input.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
          createdBy: (input.createdBy as AgentType) || 'chatgpt_moderator',
          dependencies: input.dependencies,
          metadata: input.metadata,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(task, null, 2),
            },
          ],
        };
      }

      case 'route_task': {
        const input = args as {
          taskId: string;
          context?: string;
        };
        const result = coordination.routeTask({
          taskId: input.taskId,
          context: input.context,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_task_status': {
        const input = args as {
          taskId: string;
          status: string;
          notes?: string;
        };
        const result = coordination.updateTaskStatus({
          taskId: input.taskId,
          status: input.status as TaskStatus,
          notes: input.notes,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_task': {
        const task = storage.getTask((args as { taskId: string }).taskId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(task, null, 2),
            },
          ],
        };
      }

      case 'list_tasks': {
        const input = args as {
          status?: string;
          assignedTo?: string;
          phase?: string;
        };
        const tasks = storage.listTasks({
          status: input.status as TaskStatus | undefined,
          assignedTo: input.assignedTo as AgentType | undefined,
          phase: input.phase as WorkflowPhase | undefined,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      }

      // === ARTIFACT MANAGEMENT ===
      case 'submit_artifact': {
        const input = args as {
          taskId: string;
          artifactType: string;
          name: string;
          description: string;
          content: string;
          createdBy: string;
          metadata?: Record<string, unknown>;
        };
        const artifact = coordination.submitArtifact({
          taskId: input.taskId,
          type: input.artifactType as ArtifactType,
          name: input.name,
          description: input.description,
          content: input.content,
          createdBy: input.createdBy as AgentType,
          metadata: input.metadata,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(artifact, null, 2),
            },
          ],
        };
      }

      case 'get_artifact': {
        const artifact = storage.getArtifact(
          (args as { artifactId: string }).artifactId
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(artifact, null, 2),
            },
          ],
        };
      }

      case 'list_artifacts': {
        const input = args as {
          artifactType?: string;
          createdBy?: string;
        };
        const artifacts = storage.listArtifacts({
          type: input.artifactType as ArtifactType | undefined,
          createdBy: input.createdBy as AgentType | undefined,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(artifacts, null, 2),
            },
          ],
        };
      }

      // === VALIDATION WORKFLOWS ===
      case 'request_validation': {
        const input = args as {
          artifactId: string;
          validationType: string;
          validatorAgent: string;
          requestedBy: string;
          criteria?: string;
        };
        const validation = workflow.requestValidation({
          artifactId: input.artifactId,
          validationType: input.validationType as 'safety' | 'correctness' | 'quality' | 'completeness',
          validatorAgent: input.validatorAgent as AgentType,
          requestedBy: input.requestedBy as AgentType,
          criteria: input.criteria,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(validation, null, 2),
            },
          ],
        };
      }

      case 'submit_validation_result': {
        const input = args as {
          validationId: string;
          approved: boolean;
          feedback: string;
          suggestions?: string;
        };
        const result = workflow.submitValidationResult({
          validationId: input.validationId,
          approved: input.approved,
          feedback: input.feedback,
          suggestions: input.suggestions,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_validation_status': {
        const validation = storage.getValidation(
          (args as { validationId: string }).validationId
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(validation, null, 2),
            },
          ],
        };
      }

      // === AGENT COMMUNICATION ===
      case 'send_message': {
        const input = args as {
          from: string;
          to: string;
          subject: string;
          content: string;
          priority?: string;
          relatedTaskId?: string;
          relatedArtifactId?: string;
        };
        const message = coordination.sendMessage({
          from: input.from as AgentType,
          to: input.to as AgentType,
          subject: input.subject,
          content: input.content,
          priority: (input.priority as 'low' | 'normal' | 'high' | 'urgent') || 'normal',
          relatedTaskId: input.relatedTaskId,
          relatedArtifactId: input.relatedArtifactId,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(message, null, 2),
            },
          ],
        };
      }

      case 'get_messages': {
        const input = args as {
          agent: string;
          unreadOnly?: boolean;
        };
        const messages = coordination.getMessages({
          agent: input.agent as AgentType,
          unreadOnly: input.unreadOnly,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(messages, null, 2),
            },
          ],
        };
      }

      // === ESCALATIONS ===
      case 'escalate_issue': {
        const input = args as {
          raisedBy: string;
          issue: string;
          context: string;
          severity: string;
          suggestedAction?: string;
          relatedTaskId?: string;
          relatedArtifactId?: string;
        };
        const escalation = coordination.escalateIssue({
          raisedBy: input.raisedBy as AgentType,
          issue: input.issue,
          context: input.context,
          severity: input.severity as 'low' | 'medium' | 'high' | 'critical',
          suggestedAction: input.suggestedAction,
          relatedTaskId: input.relatedTaskId,
          relatedArtifactId: input.relatedArtifactId,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(escalation, null, 2),
            },
          ],
        };
      }

      case 'resolve_escalation': {
        const input = args as {
          escalationId: string;
          resolution: string;
          resolvedBy: string;
        };
        const result = coordination.resolveEscalation({
          escalationId: input.escalationId,
          resolution: input.resolution,
          resolvedBy: input.resolvedBy as AgentType,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // === PROJECT STATE ===
      case 'get_project_state': {
        const state = workflow.getProjectState();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(state, null, 2),
            },
          ],
        };
      }

      case 'update_agent_status': {
        const input = args as {
          agent: string;
          status: string;
          details?: string;
        };
        coordination.updateAgentStatus({
          agent: input.agent as AgentType,
          status: input.status,
          details: input.details,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true }, null, 2),
            },
          ],
        };
      }

      // === WORKFLOW CONTROL ===
      case 'advance_phase': {
        const input = args as {
          nextPhase: string;
          justification: string;
          initiatedBy: string;
        };
        const result = workflow.advancePhase({
          nextPhase: input.nextPhase as WorkflowPhase,
          justification: input.justification,
          initiatedBy: input.initiatedBy as AgentType,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ORIGIN Coordination MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
