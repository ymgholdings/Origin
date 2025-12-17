#!/usr/bin/env node
/**
 * StorageManager - In-memory data storage for MCP server
 * Handles persistence of tasks, artifacts, validations, messages, and escalations
 */
export class StorageManager {
    tasks = new Map();
    artifacts = new Map();
    validations = new Map();
    messages = new Map(); // agentType -> messages
    escalations = new Map();
    agentStatuses = new Map();
    constructor() {
        // Initialize agent status map
        const agents = [
            'chatgpt_moderator',
            'gemini3_research',
            'gemini_gem_curator',
            'grok4_safety',
            'deepseek_reasoning',
            'claude_builder',
        ];
        agents.forEach(agent => {
            this.agentStatuses.set(agent, 'idle');
        });
    }
    // ============================================================================
    // Task Storage
    // ============================================================================
    saveTask(task) {
        this.tasks.set(task.id, task);
    }
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    listTasks(filters) {
        let tasks = Array.from(this.tasks.values());
        if (filters?.phase) {
            tasks = tasks.filter(t => t.phase === filters.phase);
        }
        if (filters?.assignedTo) {
            tasks = tasks.filter(t => t.assignedTo === filters.assignedTo);
        }
        if (filters?.status) {
            tasks = tasks.filter(t => t.status === filters.status);
        }
        return tasks;
    }
    updateTask(taskId, updates) {
        const task = this.tasks.get(taskId);
        if (!task)
            return undefined;
        const updatedTask = { ...task, ...updates };
        this.tasks.set(taskId, updatedTask);
        return updatedTask;
    }
    // ============================================================================
    // Artifact Storage
    // ============================================================================
    saveArtifact(artifact) {
        this.artifacts.set(artifact.id, artifact);
    }
    getArtifact(artifactId) {
        return this.artifacts.get(artifactId);
    }
    listArtifacts(filters) {
        let artifacts = Array.from(this.artifacts.values());
        if (filters?.type) {
            artifacts = artifacts.filter(a => a.type === filters.type);
        }
        if (filters?.createdBy) {
            artifacts = artifacts.filter(a => a.createdBy === filters.createdBy);
        }
        return artifacts;
    }
    // ============================================================================
    // Validation Storage
    // ============================================================================
    saveValidation(validation) {
        this.validations.set(validation.id, validation);
    }
    getValidation(validationId) {
        return this.validations.get(validationId);
    }
    updateValidation(validationId, updates) {
        const validation = this.validations.get(validationId);
        if (!validation)
            return undefined;
        const updated = { ...validation, ...updates };
        this.validations.set(validationId, updated);
        return updated;
    }
    listValidations(filters) {
        let validations = Array.from(this.validations.values());
        if (filters?.artifactId) {
            validations = validations.filter(v => v.artifactId === filters.artifactId);
        }
        if (filters?.validatorAgent) {
            validations = validations.filter(v => v.validatorAgent === filters.validatorAgent);
        }
        if (filters?.status) {
            validations = validations.filter(v => v.status === filters.status);
        }
        return validations;
    }
    // ============================================================================
    // Message Storage
    // ============================================================================
    saveMessage(message) {
        const recipient = message.to;
        if (!this.messages.has(recipient)) {
            this.messages.set(recipient, []);
        }
        this.messages.get(recipient).push(message);
    }
    getMessages(agentType, unreadOnly = false) {
        const messages = this.messages.get(agentType) || [];
        if (unreadOnly) {
            return messages.filter(m => !m.read);
        }
        return messages;
    }
    markMessageRead(agentType, messageId) {
        const messages = this.messages.get(agentType);
        if (!messages)
            return;
        const message = messages.find(m => m.id === messageId);
        if (message) {
            message.read = true;
        }
    }
    // ============================================================================
    // Escalation Storage
    // ============================================================================
    saveEscalation(escalation) {
        this.escalations.set(escalation.id, escalation);
    }
    getEscalation(escalationId) {
        return this.escalations.get(escalationId);
    }
    updateEscalation(escalationId, updates) {
        const escalation = this.escalations.get(escalationId);
        if (!escalation)
            return undefined;
        const updated = { ...escalation, ...updates };
        this.escalations.set(escalationId, updated);
        return updated;
    }
    listEscalations(filters) {
        let escalations = Array.from(this.escalations.values());
        if (filters?.raisedBy) {
            escalations = escalations.filter(e => e.raisedBy === filters.raisedBy);
        }
        if (filters?.status) {
            escalations = escalations.filter(e => e.status === filters.status);
        }
        return escalations;
    }
    // ============================================================================
    // Agent Status Storage
    // ============================================================================
    updateAgentStatus(agent, status) {
        this.agentStatuses.set(agent, status);
    }
    getAgentStatus(agent) {
        return this.agentStatuses.get(agent) || 'unknown';
    }
    getAllAgentStatuses() {
        const statuses = {};
        this.agentStatuses.forEach((status, agent) => {
            statuses[agent] = status;
        });
        return statuses;
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Get complete project statistics
     */
    getStats() {
        return {
            totalTasks: this.tasks.size,
            totalArtifacts: this.artifacts.size,
            totalValidations: this.validations.size,
            totalMessages: Array.from(this.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
            totalEscalations: this.escalations.size,
            tasksByStatus: this.groupBy(Array.from(this.tasks.values()), t => t.status),
            tasksByPhase: this.groupBy(Array.from(this.tasks.values()), t => t.phase),
            artifactsByType: this.groupBy(Array.from(this.artifacts.values()), a => a.type),
        };
    }
    groupBy(items, keyFn) {
        const grouped = {};
        items.forEach(item => {
            const key = keyFn(item);
            grouped[key] = (grouped[key] || 0) + 1;
        });
        return grouped;
    }
    /**
     * Clear all data (for testing)
     */
    clear() {
        this.tasks.clear();
        this.artifacts.clear();
        this.validations.clear();
        this.messages.clear();
        this.escalations.clear();
    }
}
//# sourceMappingURL=storage.js.map