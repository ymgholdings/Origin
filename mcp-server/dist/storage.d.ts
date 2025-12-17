#!/usr/bin/env node
import { Task, Artifact, ValidationRequest, Message, Escalation, AgentType, WorkflowPhase, TaskStatus, ArtifactType } from './types.js';
/**
 * StorageManager - In-memory data storage for MCP server
 * Handles persistence of tasks, artifacts, validations, messages, and escalations
 */
export declare class StorageManager {
    private tasks;
    private artifacts;
    private validations;
    private messages;
    private escalations;
    private agentStatuses;
    constructor();
    saveTask(task: Task): void;
    getTask(taskId: string): Task | undefined;
    listTasks(filters?: {
        phase?: WorkflowPhase;
        assignedTo?: AgentType;
        status?: TaskStatus;
    }): Task[];
    updateTask(taskId: string, updates: Partial<Task>): Task | undefined;
    saveArtifact(artifact: Artifact): void;
    getArtifact(artifactId: string): Artifact | undefined;
    listArtifacts(filters?: {
        type?: ArtifactType;
        createdBy?: AgentType;
    }): Artifact[];
    saveValidation(validation: ValidationRequest): void;
    getValidation(validationId: string): ValidationRequest | undefined;
    updateValidation(validationId: string, updates: Partial<ValidationRequest>): ValidationRequest | undefined;
    listValidations(filters?: {
        artifactId?: string;
        validatorAgent?: AgentType;
        status?: 'pending' | 'approved' | 'rejected';
    }): ValidationRequest[];
    saveMessage(message: Message): void;
    getMessages(agentType: AgentType, unreadOnly?: boolean): Message[];
    markMessageRead(agentType: AgentType, messageId: string): void;
    saveEscalation(escalation: Escalation): void;
    getEscalation(escalationId: string): Escalation | undefined;
    updateEscalation(escalationId: string, updates: Partial<Escalation>): Escalation | undefined;
    listEscalations(filters?: {
        raisedBy?: AgentType;
        status?: 'open' | 'in_review' | 'resolved';
    }): Escalation[];
    updateAgentStatus(agent: AgentType, status: string): void;
    getAgentStatus(agent: AgentType): string;
    getAllAgentStatuses(): Record<AgentType, string>;
    /**
     * Get complete project statistics
     */
    getStats(): {
        totalTasks: number;
        totalArtifacts: number;
        totalValidations: number;
        totalMessages: number;
        totalEscalations: number;
        tasksByStatus: Record<string, number>;
        tasksByPhase: Record<string, number>;
        artifactsByType: Record<string, number>;
    };
    private groupBy;
    /**
     * Clear all data (for testing)
     */
    clear(): void;
}
//# sourceMappingURL=storage.d.ts.map