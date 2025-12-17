#!/usr/bin/env node
import { Task, Artifact, Message, Escalation, AgentType, WorkflowPhase, TaskStatus, ArtifactType } from './types.js';
import { StorageManager } from './storage.js';
/**
 * CoordinationManager - Manages agent coordination, task routing, and communication
 */
export declare class CoordinationManager {
    private storage;
    constructor(storage: StorageManager);
    /**
     * Create a new task
     */
    createTask(params: {
        title: string;
        description: string;
        phase: WorkflowPhase;
        createdBy?: AgentType;
        priority?: 'low' | 'medium' | 'high' | 'critical';
        dependencies?: string[];
        metadata?: Record<string, unknown>;
    }): Task;
    /**
     * Route task to appropriate agent based on phase and context
     */
    routeTask(params: {
        taskId: string;
        context?: string;
    }): {
        taskId: string;
        assignedTo: AgentType;
        reasoning: string;
    };
    /**
     * Update task status
     */
    updateTaskStatus(params: {
        taskId: string;
        status: TaskStatus;
        notes?: string;
    }): Task;
    /**
     * Determine which agent should handle a task based on phase
     */
    private determineAgentForPhase;
    /**
     * Get human-readable reasoning for routing decision
     */
    private getRoutingReasoning;
    /**
     * Submit an artifact (research, code, documentation, etc.)
     */
    submitArtifact(params: {
        type: ArtifactType;
        name: string;
        description: string;
        content: string;
        createdBy: AgentType;
        taskId: string;
        metadata?: {
            source?: string;
            version?: string;
            format?: string;
            [key: string]: unknown;
        };
    }): Artifact;
    /**
     * Send message between agents
     */
    sendMessage(params: {
        from: AgentType;
        to: AgentType;
        subject: string;
        content: string;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        relatedTaskId?: string;
        relatedArtifactId?: string;
    }): Message;
    /**
     * Get messages for an agent
     */
    getMessages(params: {
        agent: AgentType;
        unreadOnly?: boolean;
    }): Message[];
    /**
     * Escalate an issue to moderator
     */
    escalateIssue(params: {
        raisedBy: AgentType;
        severity: 'low' | 'medium' | 'high' | 'critical';
        issue: string;
        context: string;
        suggestedAction?: string;
        relatedTaskId?: string;
        relatedArtifactId?: string;
    }): Escalation;
    /**
     * Resolve an escalation
     */
    resolveEscalation(params: {
        escalationId: string;
        resolution: string;
        resolvedBy: AgentType;
    }): Escalation;
    /**
     * Update agent status
     */
    updateAgentStatus(params: {
        agent: AgentType;
        status: string;
        details?: string;
    }): void;
    private generateId;
}
//# sourceMappingURL=coordination.d.ts.map