/**
 * BG3-style 3D Dice Rolling Animation
 * 
 * Renders spinning polyhedral dice in a 3D scene. The dice spin rapidly,
 * then slow down and "land" before revealing the result. Uses React Three Fiber.
 */
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { createDieGeometry, getDieColor, getDieEmissive } from './DiceGeometries';

// ── Types ───────────────────────────────────────────────────────────────

interface DieConfig {
  sides: number;
  result: number;
  index: number;
  total: number; // total dice in the roll
}

interface DiceRoller3DProps {
  /** Array of dice to roll: each entry is { sides, result } */
  dice: { sides: number; result: number }[];
  /** Called when the animation finishes */
  onComplete: () => void;
  /** Duration of the roll animation in ms */
  duration?: number;
}

// ── Constants ───────────────────────────────────────────────────────────

const ROLL_DURATION = 1800; // ms
const SETTLE_DURATION = 600; // ms — slowdown phase at the end

// ── Single Die Mesh ─────────────────────────────────────────────────────

function SpinningDie({ sides, result, index, total }: DieConfig) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Unique random axis + speed for each die
  const config = useMemo(() => {
    const angle = (index / Math.max(total, 1)) * Math.PI * 2;
    const radius = total === 1 ? 0 : Math.min(total * 0.4, 2.5);
    return {
      axis: new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize(),
      speed: 8 + Math.random() * 6,
      // Spread dice in a circle
      posX: Math.sin(angle) * radius,
      posZ: Math.cos(angle) * radius,
      // Random starting rotation
      startRotX: Math.random() * Math.PI * 2,
      startRotY: Math.random() * Math.PI * 2,
      startRotZ: Math.random() * Math.PI * 2,
      // Bounce parameters
      bouncePhase: Math.random() * Math.PI * 2,
      bounceAmp: 0.3 + Math.random() * 0.4,
    };
  }, [index, total]);

  const geometry = useMemo(() => createDieGeometry(sides), [sides]);
  const startTime = useMemo(() => performance.now(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = performance.now() - startTime;
    const totalDur = ROLL_DURATION + SETTLE_DURATION;
    const t = Math.min(elapsed / totalDur, 1);

    // Easing: fast spin that decelerates
    // Phase 1: full spin (0 → spinEnd)
    const spinEnd = ROLL_DURATION / totalDur;
    let spinFactor: number;
    if (t < spinEnd) {
      spinFactor = 1;
    } else {
      // Phase 2: decelerate to 0
      const settleT = (t - spinEnd) / (1 - spinEnd);
      spinFactor = 1 - easeInQuad(settleT);
    }

    const rotAmount = elapsed * 0.001 * config.speed * spinFactor;
    meshRef.current.rotation.x = config.startRotX + config.axis.x * rotAmount;
    meshRef.current.rotation.y = config.startRotY + config.axis.y * rotAmount;
    meshRef.current.rotation.z = config.startRotZ + config.axis.z * rotAmount;

    // Bounce effect during spin
    const bounceT = Math.max(0, 1 - t * 1.5); // fade out bounce
    meshRef.current.position.y =
      Math.abs(Math.sin(elapsed * 0.006 + config.bouncePhase)) *
      config.bounceAmp *
      bounceT;

    // Scale pop at start
    const scaleT = Math.min(elapsed / 200, 1);
    const scale = 0.3 + 0.7 * easeOutBack(scaleT);
    meshRef.current.scale.setScalar(scale);
  });

  const color = getDieColor(sides);
  const emissive = getDieEmissive(sides);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[config.posX, 0, config.posZ]}
      castShadow
    >
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.15}
        metalness={0.3}
        roughness={0.4}
      />
    </mesh>
  );
}

// ── Particle burst effect ───────────────────────────────────────────────

function ParticleBurst() {
  const pointsRef = useRef<THREE.Points>(null);
  const startTime = useMemo(() => performance.now(), []);

  const { positions, velocities } = useMemo(() => {
    const count = 40;
    const pos = new Float32Array(count * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      vel.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4
        )
      );
    }
    return { positions: pos, velocities: vel };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const elapsed = (performance.now() - startTime) * 0.001;
    const posAttr = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    for (let i = 0; i < velocities.length; i++) {
      posAttr.array[i * 3] = velocities[i].x * elapsed;
      posAttr.array[i * 3 + 1] =
        velocities[i].y * elapsed - 4.9 * elapsed * elapsed;
      posAttr.array[i * 3 + 2] = velocities[i].z * elapsed;
    }
    posAttr.needsUpdate = true;
    // Fade out
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 1 - elapsed * 0.8);
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.08}
        color="#f1c40f"
        transparent
        opacity={1}
        depthWrite={false}
      />
    </points>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export const DiceRoller3D: React.FC<DiceRoller3DProps> = ({
  dice,
  onComplete,
  duration = ROLL_DURATION + SETTLE_DURATION,
}) => {
  const [phase, setPhase] = useState<'rolling' | 'done'>('rolling');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <div className="w-full h-32 rounded-md overflow-hidden relative">
      <Canvas
        camera={{ position: [0, 3, 4], fov: 45 }}
        shadows
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
        <pointLight position={[-2, 3, -1]} intensity={0.5} color="#f1c40f" />

        {dice.map((d, i) => (
          <SpinningDie
            key={i}
            sides={d.sides}
            result={d.result}
            index={i}
            total={dice.length}
          />
        ))}

        <ParticleBurst />
      </Canvas>

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-md"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, hsl(var(--background) / 0.6) 100%)',
        }}
      />
    </div>
  );
};

// ── Easing helpers ──────────────────────────────────────────────────────

function easeInQuad(t: number): number {
  return t * t;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
