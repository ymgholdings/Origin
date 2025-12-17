#!/usr/bin/env node
/**
 * CoordinationManager - Manages agent coordination, task routing, and communication
 */
export class CoordinationManager {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    // ============================================================================
    // Task Management
    // ============================================================================
    /**
     * Create a new task
     */
    createTask(params) {
        const task = {
            id: this.generateId('task'),
            title: params.title,
            description: params.description,
            phase: params.phase,
            status: 'pending',
            createdBy: params.createdBy || 'chatgpt_moderator',
            priority: params.priority || 'medium',
            dependencies: params.dependencies || [],
            artifacts: [],
            metadata: params.metadata || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.storage.saveTask(task);
        return task;
    }
    /**
     * Route task to appropriate agent based on phase and context
     */
    routeTask(params) {
        const task = this.storage.getTask(params.taskId);
        if (!task) {
            throw new Error(`Task ${params.taskId} not found`);
        }
        // Routing logic based on workflow phase
        const agent = this.determineAgentForPhase(task.phase, params.context);
        const reasoning = this.getRoutingReasoning(task.phase, agent);
        // Update task with assignment
        this.storage.updateTask(params.taskId, {
            assignedTo: agent,
            status: 'in_progress',
            updatedAt: new Date().toISOString(),
        });
        // Send notification message to assigned agent
        this.sendMessage({
            from: 'chatgpt_moderator',
            to: agent,
            subject: `New Task Assignment: ${task.title}`,
            content: `You have been assigned task ${params.taskId}:\n\n${task.description}\n\nPhase: ${task.phase}\nContext: ${params.context || 'N/A'}`,
            priority: 'normal',
            relatedTaskId: params.taskId,
        });
        return {
            taskId: params.taskId,
            assignedTo: agent,
            reasoning,
        };
    }
    /**
     * Update task status
     */
    updateTaskStatus(params) {
        const task = this.storage.getTask(params.taskId);
        if (!task) {
            throw new Error(`Task ${params.taskId} not found`);
        }
        const updatedTask = this.storage.updateTask(params.taskId, {
            status: params.status,
            updatedAt: new Date().toISOString(),
        });
        if (!updatedTask) {
            throw new Error(`Failed to update task ${params.taskId}`);
        }
        // If task is completed, notify moderator
        if (params.status === 'completed') {
            this.sendMessage({
                from: task.assignedTo || 'claude_builder',
                to: 'chatgpt_moderator',
                subject: `Task Completed: ${task.title}`,
                content: `Task ${params.taskId} has been completed.\n\nNotes: ${params.notes || 'None'}`,
                priority: 'normal',
                relatedTaskId: params.taskId,
            });
        }
        return updatedTask;
    }
    /**
     * Determine which agent should handle a task based on phase
     */
    determineAgentForPhase(phase, context) {
        switch (phase) {
            case 'intake_research':
                // Research phase: Gemini 3 for research, GEM for curation
                return context?.includes('curate') || context?.includes('segment')
                    ? 'gemini_gem_curator'
                    : 'gemini3_research';
            case 'conversion_preparation':
                // LaTeX conversion and preparation: GEM curator
                return 'gemini_gem_curator';
            case 'reasoning_analysis':
                // Complex reasoning: DeepSeek V3.2
                return 'deepseek_reasoning';
            case 'implementation':
                // Code implementation: Claude Builder
                return 'claude_builder';
            case 'validation_safety':
                // Safety validation: Grok 4
                return 'grok4_safety';
            case 'deployment':
                // Deployment tasks: Claude Builder
                return 'claude_builder';
            default:
                return 'chatgpt_moderator';
        }
    }
    /**
     * Get human-readable reasoning for routing decision
     */
    getRoutingReasoning(phase, agent) {
        const reasons = {
            intake_research: 'Research and intake phase requires document analysis and information gathering',
            conversion_preparation: 'LaTeX conversion requires lossless curation and segmentation',
            reasoning_analysis: 'Complex reasoning requires mathematical analysis and proof validation',
            implementation: 'Implementation requires full-stack development capabilities',
            validation_safety: 'Validation requires safety analysis and correctness verification',
            deployment: 'Deployment requires production configuration and monitoring',
        };
        return `${reasons[phase] || 'Standard workflow routing'}. Assigned to ${agent}.`;
    }
    // ============================================================================
    // Artifact Management
    // ============================================================================
    /**
     * Submit an artifact (research, code, documentation, etc.)
     */
    submitArtifact(params) {
        const artifact = {
            id: this.generateId('artifact'),
            type: params.type,
            name: params.name,
            description: params.description,
            content: params.content,
            createdBy: params.createdBy,
            taskId: params.taskId,
            createdAt: new Date().toISOString(),
            metadata: params.metadata || {},
        };
        this.storage.saveArtifact(artifact);
        // Link artifact to task
        const task = this.storage.getTask(params.taskId);
        if (task) {
            const artifacts = [...task.artifacts, artifact.id];
            this.storage.updateTask(params.taskId, {
                artifacts,
                updatedAt: new Date().toISOString(),
            });
        }
        // Notify moderator of new artifact
        this.sendMessage({
            from: params.createdBy,
            to: 'chatgpt_moderator',
            subject: `New Artifact Submitted: ${params.type}`,
            content: `Agent ${params.createdBy} has submitted a new ${params.type} artifact.\n\nArtifact ID: ${artifact.id}\nTask: ${params.taskId}`,
            priority: 'normal',
            relatedArtifactId: artifact.id,
        });
        return artifact;
    }
    // ============================================================================
    // Agent Communication
    // ============================================================================
    /**
     * Send message between agents
     */
    sendMessage(params) {
        const message = {
            id: this.generateId('msg'),
            from: params.from,
            to: params.to,
            subject: params.subject,
            content: params.content,
            priority: params.priority || 'normal',
            timestamp: new Date().toISOString(),
            read: false,
            relatedTaskId: params.relatedTaskId,
            relatedArtifactId: params.relatedArtifactId,
        };
        this.storage.saveMessage(message);
        return message;
    }
    /**
     * Get messages for an agent
     */
    getMessages(params) {
        return this.storage.getMessages(params.agent, params.unreadOnly || false);
    }
    // ============================================================================
    // Escalations
    // ============================================================================
    /**
     * Escalate an issue to moderator
     */
    escalateIssue(params) {
        const escalation = {
            id: this.generateId('escalation'),
            raisedBy: params.raisedBy,
            severity: params.severity,
            issue: params.issue,
            context: params.context,
            suggestedAction: params.suggestedAction,
            status: 'open',
            createdAt: new Date().toISOString(),
            relatedTaskId: params.relatedTaskId,
            relatedArtifactId: params.relatedArtifactId,
        };
        this.storage.saveEscalation(escalation);
        // Send urgent message to moderator
        this.sendMessage({
            from: params.raisedBy,
            to: 'chatgpt_moderator',
            subject: `🚨 ESCALATION [${params.severity.toUpperCase()}]: ${params.issue}`,
            content: `Agent ${params.raisedBy} has escalated an issue:\n\nSeverity: ${params.severity}\nIssue: ${params.issue}\n\nContext:\n${params.context}\n\nSuggested Action: ${params.suggestedAction || 'None provided'}\n\nEscalation ID: ${escalation.id}`,
            priority: params.severity === 'critical' ? 'urgent' : 'high',
            relatedTaskId: params.relatedTaskId,
            relatedArtifactId: params.relatedArtifactId,
        });
        return escalation;
    }
    /**
     * Resolve an escalation
     */
    resolveEscalation(params) {
        const escalation = this.storage.getEscalation(params.escalationId);
        if (!escalation) {
            throw new Error(`Escalation ${params.escalationId} not found`);
        }
        const updated = this.storage.updateEscalation(params.escalationId, {
            status: 'resolved',
            resolution: params.resolution,
            resolvedBy: params.resolvedBy,
            resolvedAt: new Date().toISOString(),
        });
        if (!updated) {
            throw new Error(`Failed to resolve escalation ${params.escalationId}`);
        }
        // Notify the agent who raised the escalation
        this.sendMessage({
            from: params.resolvedBy,
            to: escalation.raisedBy,
            subject: `Escalation Resolved: ${escalation.issue}`,
            content: `Your escalation has been resolved.\n\nResolution:\n${params.resolution}\n\nEscalation ID: ${params.escalationId}`,
            priority: 'normal',
        });
        return updated;
    }
    // ============================================================================
    // Agent Status
    // ============================================================================
    /**
     * Update agent status
     */
    updateAgentStatus(params) {
        this.storage.updateAgentStatus(params.agent, params.status);
        // Log status change (could be extended to send notifications)
        console.log(`[${new Date().toISOString()}] Agent ${params.agent} status: ${params.status}${params.details ? ` - ${params.details}` : ''}`);
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    generateId(prefix) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}_${timestamp}_${random}`;
    }
}
//# sourceMappingURL=coordination.js.map