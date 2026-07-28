"use client";

import { useMemo } from "react";
import * as THREE from "three";

// A recognizable motorcycle built entirely from primitives — no external asset
// or licensing. This is the drop-in point for a real .glb later (swap this
// component's body for a useGLTF model, keep the same props).
export function Motorcycle({ bodyColor }: { bodyColor: string }) {
  const paint = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(bodyColor),
        metalness: 0.6,
        roughness: 0.3,
      }),
    [bodyColor],
  );
  const rubber = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.8 }),
    [],
  );
  const chrome = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: "#d4d4d8", metalness: 0.9, roughness: 0.2 }),
    [],
  );
  const seatMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#111114", roughness: 0.7 }),
    [],
  );

  // Two wheels along the X axis; bike faces +X.
  const wheel = (x: number) => (
    <group position={[x, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
      {/* tyre */}
      <mesh material={rubber} castShadow>
        <torusGeometry args={[0.52, 0.16, 16, 40]} />
      </mesh>
      {/* rim */}
      <mesh material={chrome}>
        <cylinderGeometry args={[0.38, 0.38, 0.12, 24]} />
      </mesh>
    </group>
  );

  return (
    <group>
      {wheel(1.15)}
      {wheel(-1.15)}

      {/* front fork */}
      <mesh material={chrome} position={[1.05, 1.0, 0]} rotation={[0, 0, -0.35]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.1, 12]} />
      </mesh>
      {/* rear frame strut */}
      <mesh material={paint} position={[-0.7, 1.0, 0]} rotation={[0, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 1.1, 12]} />
      </mesh>

      {/* fuel tank */}
      <mesh material={paint} position={[0.2, 1.28, 0]} castShadow>
        <sphereGeometry args={[0.42, 24, 16]} />
      </mesh>
      {/* main body / engine block */}
      <mesh material={paint} position={[-0.05, 0.95, 0]} castShadow>
        <boxGeometry args={[1.5, 0.55, 0.55]} />
      </mesh>
      {/* engine detail */}
      <mesh material={chrome} position={[0.1, 0.72, 0]} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.5]} />
      </mesh>

      {/* seat */}
      <mesh material={seatMat} position={[-0.55, 1.32, 0]} castShadow>
        <boxGeometry args={[0.95, 0.18, 0.42]} />
      </mesh>

      {/* handlebars */}
      <mesh material={chrome} position={[1.05, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.7, 10]} />
      </mesh>
      {/* headlight */}
      <mesh material={chrome} position={[1.35, 1.35, 0]} castShadow>
        <sphereGeometry args={[0.16, 20, 16]} />
      </mesh>

      {/* exhaust */}
      <mesh material={chrome} position={[-0.4, 0.62, 0.28]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1.4, 14]} />
      </mesh>
    </group>
  );
}
