import { type GameState, type InputAction, GamePhase, RotationState } from "../core/types.ts";
import { findBestPlacement } from "./ai-brain.ts";
import type { AIPlacement } from "./ai-brain.ts";

enum ControllerPhase {
  IDLE,
  ROTATING,
  MOVING,
  DROPPING,
}

export interface AIControllerConfig {
  actionInterval: number;
  useHold: boolean;
}

function shortestRotation(current: RotationState, target: RotationState): InputAction {
  const cw = (target - current + 4) % 4;
  const ccw = (current - target + 4) % 4;
  return cw <= ccw ? { type: "RotateCW" as const } : { type: "RotateCCW" as const };
}

export class AIController {
  private phase: ControllerPhase = ControllerPhase.IDLE;
  private config: AIControllerConfig;
  private currentPlacement: AIPlacement | null = null;
  private cooldownTimer: number = 0;
  private moveAttempts: number = 0;
  private rotationAttempts: number = 0;

  constructor(config?: Partial<AIControllerConfig>) {
    this.config = {
      actionInterval: config?.actionInterval ?? 150,
      useHold: config?.useHold ?? true,
    };
  }

  update(state: GameState, dt: number): InputAction | null {
    if (state.phase !== GamePhase.Playing || !state.activePiece) {
      this.reset();
      return null;
    }

    switch (this.phase) {
      case ControllerPhase.IDLE:
        return this.onIdle(state);
      case ControllerPhase.ROTATING:
      case ControllerPhase.MOVING:
        // Paced actions require cooldown
        this.cooldownTimer += dt;
        if (this.cooldownTimer < this.config.actionInterval) {
          return null;
        }
        if (this.phase === ControllerPhase.ROTATING) {
          return this.onRotating(state);
        }
        return this.onMoving(state);
      case ControllerPhase.DROPPING:
        this.cooldownTimer += dt;
        if (this.cooldownTimer < this.config.actionInterval) {
          return null;
        }
        return this.onDropping();
    }
  }

  /** Testing only: inject a placement to bypass the brain. */
  __testSetPlacement(placement: AIPlacement): void {
    this.currentPlacement = placement;
    this.phase = ControllerPhase.ROTATING;
    this.rotationAttempts = 0;
    this.moveAttempts = 0;
    this.cooldownTimer = this.config.actionInterval;
  }

  reset(): void {
    this.phase = ControllerPhase.IDLE;
    this.currentPlacement = null;
    this.cooldownTimer = 0;
    this.moveAttempts = 0;
    this.rotationAttempts = 0;
  }

  private onIdle(state: GameState): InputAction | null {
    const placement = findBestPlacement(state);
    if (!placement) return null;

    this.currentPlacement = placement;

    if (placement.usesHold && this.config.useHold && !state.hasSwappedThisTurn) {
      this.cooldownTimer = 0;
      return { type: "Hold" };
    }

    this.phase = ControllerPhase.ROTATING;
    this.rotationAttempts = 0;
    this.cooldownTimer = 0;
    return null;
  }

  private onRotating(state: GameState): InputAction | null {
    if (!this.currentPlacement || !state.activePiece) {
      this.reset();
      return null;
    }

    if (state.activePiece.rotation === this.currentPlacement.targetRotation) {
      this.phase = ControllerPhase.MOVING;
      this.moveAttempts = 0;
      this.cooldownTimer = 0;
      return null;
    }

    this.rotationAttempts++;
    if (this.rotationAttempts > 4) {
      this.phase = ControllerPhase.MOVING;
      this.moveAttempts = 0;
      this.cooldownTimer = 0;
      return null;
    }

    this.cooldownTimer = 0;
    return shortestRotation(state.activePiece.rotation, this.currentPlacement.targetRotation);
  }

  private onMoving(state: GameState): InputAction | null {
    if (!this.currentPlacement || !state.activePiece) {
      this.reset();
      return null;
    }

    const pieceX = state.activePiece.pos.x;

    if (pieceX === this.currentPlacement.targetX) {
      this.phase = ControllerPhase.DROPPING;
      this.cooldownTimer = 0;
      return null;
    }

    this.moveAttempts++;
    if (this.moveAttempts > 20) {
      this.phase = ControllerPhase.DROPPING;
      this.cooldownTimer = 0;
      return null;
    }

    this.cooldownTimer = 0;
    return pieceX < this.currentPlacement.targetX
      ? { type: "MoveRight" }
      : { type: "MoveLeft" };
  }

  private onDropping(): InputAction | null {
    this.reset();
    return { type: "HardDrop" };
  }
}

export function createAttractAIController(): AIController {
  return new AIController({ actionInterval: 150, useHold: true });
}

export function createCPUAIController(difficulty: number = 5): AIController {
  const interval = Math.max(30, 100 - difficulty * 10);
  return new AIController({ actionInterval: interval, useHold: true });
}
