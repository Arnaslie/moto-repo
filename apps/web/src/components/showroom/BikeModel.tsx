"use client";

import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";

// A placeholder, not a bike: this is a box on a plinth until a real asset is
// loaded here. The surrounding scene, lighting, turntable and per-bike tint all
// stay the same when it is.
export function BikeModel({ bodyColor }: { bodyColor: string }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(bodyColor),
        metalness: 0.3,
        roughness: 0.45,
        transparent: true,
        opacity: 0.85,
      }),
    [bodyColor],
  );

  return (
    <group position={[0, 1.05, 0]}>
      <mesh material={material} castShadow>
        <boxGeometry args={[1.8, 1.3, 0.9]} />
        <Edges scale={1} threshold={15} color="#ffffff" />
      </mesh>
      {/* small plinth under the block */}
      <mesh position={[0, -0.75, 0]} receiveShadow>
        <cylinderGeometry args={[0.9, 1.0, 0.2, 32]} />
        <meshStandardMaterial color="#3f3f46" metalness={0.4} roughness={0.6} />
      </mesh>
    </group>
  );
}
