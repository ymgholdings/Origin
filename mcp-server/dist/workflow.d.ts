#!/usr/bin/env node
import { ValidationRequest, WorkflowPhase, AgentType, ProjectState } from './types.js';
import { StorageManager } from './storage.js';
import { CoordinationManager } from './coordination.js';
/**
 * WorkflowManager - Manages validation workflows and phase transitions
 */
export declare class WorkflowManager {
    private storage;
    private coordination;
    private currentPhase;
    private phaseHistory;
    constructor(storage: StorageManager, coordination: CoordinationManager);
    /**
     * Request validation for an artifact
     */
    requestValidation(params: {
        artifactId: string;
        validatorAgent: AgentType;
        validationType: 'safety' | 'correctness' | 'quality' | 'completeness';
        criteria?: string;
        requestedBy: AgentType;
    }): ValidationRequest;
    /**
     * Submit validation result
     */
    submitValidationResult(params: {
        validationId: string;
        approved: boolean;
        feedback: string;
        suggestions?: string;
    }): ValidationRequest;
    /**
     * Advance to next workflow phase
     */
    advancePhase(params: {
        nextPhase: WorkflowPhase;
        justification: string;
        initiatedBy: AgentType;
    }): {
        success: boolean;
        currentPhase: WorkflowPhase;
        message: string;
    };
    /**
     * Check if phase transition is valid
     */
    private isValidPhaseTransition;
    /**
     * Check if current phase requirements are met
     */
    private checkPhaseRequirements;
    /**
     * Get complete project state
     */
    getProjectState(): ProjectState;
    /**
     * Calculate progress through current phase
     */
    private calculatePhaseProgress;
    /**
     * Get workflow recommendations based on current state
     */
    getWorkflowRecommendations(): Array<{
        type: 'action' | 'warning' | 'info';
        message: string;
        priority: 'low' | 'medium' | 'high';
    }>;
    private generateId;
    private groupBy;
    /**
     * Get current phase
     */
    getCurrentPhase(): WorkflowPhase;
    /**
     * Get phase history
     */
    getPhaseHistory(): Array<{
        phase: WorkflowPhase;
        timestamp: string;
    }>;
}
//# sourceMappingURL=workflow.d.ts.map