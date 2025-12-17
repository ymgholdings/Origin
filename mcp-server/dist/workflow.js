#!/usr/bin/env node
/**
 * WorkflowManager - Manages validation workflows and phase transitions
 */
export class WorkflowManager {
    storage;
    coordination;
    currentPhase = 'intake_research';
    phaseHistory = [];
    constructor(storage, coordination) {
        this.storage = storage;
        this.coordination = coordination;
        this.phaseHistory.push({
            phase: this.currentPhase,
            timestamp: new Date().toISOString(),
        });
    }
    // ============================================================================
    // Validation Workflows
    // ============================================================================
    /**
     * Request validation for an artifact
     */
    requestValidation(params) {
        const artifact = this.storage.getArtifact(params.artifactId);
        if (!artifact) {
            throw new Error(`Artifact ${params.artifactId} not found`);
        }
        const validation = {
            id: this.generateId('validation'),
            artifactId: params.artifactId,
            validatorAgent: params.validatorAgent,
            validationType: params.validationType,
            criteria: params.criteria,
            status: 'pending',
            requestedBy: params.requestedBy,
            requestedAt: new Date().toISOString(),
        };
        this.storage.saveValidation(validation);
        // Send validation request to validator agent
        this.coordination.sendMessage({
            from: params.requestedBy,
            to: params.validatorAgent,
            subject: `Validation Request: ${params.validationType}`,
            content: `Please validate artifact ${params.artifactId} (${artifact.type}).\n\nValidation Type: ${params.validationType}\nCriteria: ${params.criteria || 'Standard validation criteria'}\n\nValidation ID: ${validation.id}`,
            priority: params.validationType === 'safety' ? 'high' : 'normal',
            relatedArtifactId: params.artifactId,
        });
        return validation;
    }
    /**
     * Submit validation result
     */
    submitValidationResult(params) {
        const validation = this.storage.getValidation(params.validationId);
        if (!validation) {
            throw new Error(`Validation ${params.validationId} not found`);
        }
        const updated = this.storage.updateValidation(params.validationId, {
            status: params.approved ? 'approved' : 'rejected',
            feedback: params.feedback,
            suggestions: params.suggestions,
            completedAt: new Date().toISOString(),
        });
        if (!updated) {
            throw new Error(`Failed to update validation ${params.validationId}`);
        }
        // If approved, update artifact metadata
        if (params.approved) {
            const artifact = this.storage.getArtifact(validation.artifactId);
            if (artifact) {
                artifact.metadata.approvedBy = validation.validatorAgent;
            }
        }
        // Notify requester of validation result
        this.coordination.sendMessage({
            from: validation.validatorAgent,
            to: validation.requestedBy,
            subject: `Validation ${params.approved ? 'Approved' : 'Rejected'}: ${validation.validationType}`,
            content: `Validation for artifact ${validation.artifactId} has been ${params.approved ? 'approved' : 'rejected'}.\n\nFeedback:\n${params.feedback}\n\n${params.suggestions ? `Suggestions:\n${params.suggestions}` : ''}`,
            priority: params.approved ? 'normal' : 'high',
            relatedArtifactId: validation.artifactId,
        });
        return updated;
    }
    // ============================================================================
    // Phase Management
    // ============================================================================
    /**
     * Advance to next workflow phase
     */
    advancePhase(params) {
        // Verify phase transition is valid
        const isValid = this.isValidPhaseTransition(this.currentPhase, params.nextPhase);
        if (!isValid) {
            return {
                success: false,
                currentPhase: this.currentPhase,
                message: `Invalid phase transition from ${this.currentPhase} to ${params.nextPhase}`,
            };
        }
        // Check if current phase requirements are met
        const requirements = this.checkPhaseRequirements(this.currentPhase);
        if (!requirements.met) {
            return {
                success: false,
                currentPhase: this.currentPhase,
                message: `Phase requirements not met: ${requirements.missing.join(', ')}`,
            };
        }
        // Advance phase
        const previousPhase = this.currentPhase;
        this.currentPhase = params.nextPhase;
        this.phaseHistory.push({
            phase: params.nextPhase,
            timestamp: new Date().toISOString(),
        });
        // Notify all agents of phase change
        const agents = [
            'chatgpt_moderator',
            'gemini3_research',
            'gemini_gem_curator',
            'grok4_safety',
            'deepseek_reasoning',
            'claude_builder',
        ];
        agents.forEach(agent => {
            this.coordination.sendMessage({
                from: params.initiatedBy,
                to: agent,
                subject: `Phase Transition: ${previousPhase} → ${params.nextPhase}`,
                content: `The project has advanced from ${previousPhase} to ${params.nextPhase}.\n\nJustification:\n${params.justification}\n\nPlease review any tasks assigned to you in this new phase.`,
                priority: 'high',
            });
        });
        return {
            success: true,
            currentPhase: this.currentPhase,
            message: `Successfully advanced from ${previousPhase} to ${params.nextPhase}`,
        };
    }
    /**
     * Check if phase transition is valid
     */
    isValidPhaseTransition(from, to) {
        const phaseOrder = [
            'intake_research',
            'conversion_preparation',
            'reasoning_analysis',
            'implementation',
            'validation_safety',
            'deployment',
        ];
        const fromIndex = phaseOrder.indexOf(from);
        const toIndex = phaseOrder.indexOf(to);
        // Allow moving forward one phase, or back to previous phase
        return toIndex === fromIndex + 1 || toIndex === fromIndex - 1;
    }
    /**
     * Check if current phase requirements are met
     */
    checkPhaseRequirements(phase) {
        const missing = [];
        switch (phase) {
            case 'intake_research':
                // Must have research artifacts
                const research = this.storage.listArtifacts({
                    type: 'research_brief',
                });
                if (research.length === 0) {
                    missing.push('research artifacts');
                }
                break;
            case 'conversion_preparation':
                // Must have curated segments
                const curated = this.storage.listArtifacts({
                    type: 'curated_segment',
                });
                if (curated.length === 0) {
                    missing.push('curated segments');
                }
                break;
            case 'reasoning_analysis':
                // Must have LaTeX documents
                const latex = this.storage.listArtifacts({
                    type: 'latex_document',
                });
                if (latex.length === 0) {
                    missing.push('LaTeX documents');
                }
                break;
            case 'implementation':
                // Must have reasoning reports
                const reasoning = this.storage.listArtifacts({
                    type: 'reasoning_report',
                });
                if (reasoning.length === 0) {
                    missing.push('reasoning reports');
                }
                break;
            case 'validation_safety':
                // Must have implementation code
                const code = this.storage.listArtifacts({
                    type: 'implementation_code',
                });
                if (code.length === 0) {
                    missing.push('implementation code');
                }
                break;
            case 'deployment':
                // Must have approved validation
                const validations = this.storage.listValidations({
                    status: 'approved',
                });
                if (validations.length === 0) {
                    missing.push('approved validations');
                }
                break;
        }
        return {
            met: missing.length === 0,
            missing,
        };
    }
    // ============================================================================
    // Project State
    // ============================================================================
    /**
     * Get complete project state
     */
    getProjectState() {
        const tasks = this.storage.listTasks();
        const artifacts = this.storage.listArtifacts();
        const validations = this.storage.listValidations();
        const escalations = this.storage.listEscalations();
        const agentStatuses = this.storage.getAllAgentStatuses();
        // Calculate phase progress
        const phaseProgress = this.calculatePhaseProgress();
        // Get active issues
        const activeIssues = escalations.filter(e => e.status !== 'resolved');
        // Get pending validations
        const pendingValidations = validations.filter(v => v.status === 'pending');
        return {
            currentPhase: this.currentPhase,
            phaseHistory: this.phaseHistory,
            tasks: {
                total: tasks.length,
                byStatus: this.groupBy(tasks, t => t.status),
                byPhase: this.groupBy(tasks, t => t.phase),
            },
            artifacts: {
                total: artifacts.length,
                byType: this.groupBy(artifacts, a => a.type),
            },
            validations: {
                total: validations.length,
                pending: pendingValidations.length,
                approved: validations.filter(v => v.status === 'approved').length,
                rejected: validations.filter(v => v.status === 'rejected').length,
            },
            escalations: {
                total: escalations.length,
                active: activeIssues.length,
                bySeverity: this.groupBy(activeIssues, e => e.severity),
            },
            agentStatuses,
            phaseProgress,
            lastUpdated: new Date().toISOString(),
        };
    }
    /**
     * Calculate progress through current phase
     */
    calculatePhaseProgress() {
        const phaseTasks = this.storage.listTasks({ phase: this.currentPhase });
        if (phaseTasks.length === 0)
            return 0;
        const completed = phaseTasks.filter(t => t.status === 'completed').length;
        return Math.round((completed / phaseTasks.length) * 100);
    }
    // ============================================================================
    // Workflow Recommendations
    // ============================================================================
    /**
     * Get workflow recommendations based on current state
     */
    getWorkflowRecommendations() {
        const recommendations = [];
        // Check for blocked tasks
        const blockedTasks = this.storage.listTasks({ status: 'blocked' });
        if (blockedTasks.length > 0) {
            recommendations.push({
                type: 'warning',
                message: `${blockedTasks.length} task(s) are blocked and need attention`,
                priority: 'high',
            });
        }
        // Check for pending validations
        const pendingValidations = this.storage.listValidations({ status: 'pending' });
        if (pendingValidations.length > 3) {
            recommendations.push({
                type: 'action',
                message: `${pendingValidations.length} pending validations - consider prioritizing`,
                priority: 'medium',
            });
        }
        // Check for open escalations
        const openEscalations = this.storage.listEscalations({ status: 'open' });
        if (openEscalations.length > 0) {
            recommendations.push({
                type: 'warning',
                message: `${openEscalations.length} open escalation(s) require resolution`,
                priority: 'high',
            });
        }
        // Check phase progress
        const progress = this.calculatePhaseProgress();
        if (progress >= 80) {
            recommendations.push({
                type: 'info',
                message: `Phase ${this.currentPhase} is ${progress}% complete - consider phase transition`,
                priority: 'low',
            });
        }
        return recommendations;
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    generateId(prefix) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}_${timestamp}_${random}`;
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
     * Get current phase
     */
    getCurrentPhase() {
        return this.currentPhase;
    }
    /**
     * Get phase history
     */
    getPhaseHistory() {
        return [...this.phaseHistory];
    }
}
//# sourceMappingURL=workflow.js.map