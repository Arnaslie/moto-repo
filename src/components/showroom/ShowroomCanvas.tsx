"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import { Motorcycle } from "./Motorcycle";

// A deterministic paint color per bike so each looks distinct.
function colorForBike(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 52%)`;
}

// The bike + platform slowly rotate together, convention-floor style.
function Turntable({ color }: { color: string }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={ref}>
      <Motorcycle bodyColor={color} />
      {/* platform */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[2.4, 2.6, 0.1, 64]} />
        <meshStandardMaterial color="#26262b" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* glowing rim ring */}
      <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.3, 2.45, 64]} />
        <meshBasicMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

export default function ShowroomCanvas({ seed }: { seed: string }) {
  const color = colorForBike(seed);

  return (
    <Canvas
      shadows
      camera={{ position: [4.5, 3, 5], fov: 42 }}
      dpr={[1, 2]}
      className="!absolute inset-0"
    >
      <color attach="background" args={["#0b0b0f"]} />
      <fog attach="fog" args={["#0b0b0f", 9, 20]} />

      {/* showroom lighting */}
      <ambientLight intensity={0.35} />
      <spotLight
        position={[6, 9, 5]}
        angle={0.5}
        penumbra={0.7}
        intensity={700}
        castShadow
        shadow-mapSize={[1024, 1024]}
        color="#ffffff"
      />
      <spotLight position={[-7, 5, -4]} angle={0.6} penumbra={1} intensity={250} color="#f97316" />
      <pointLight position={[0, 2, 6]} intensity={40} color="#38bdf8" />

      <Turntable color={color} />

      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.6}
        scale={10}
        blur={2.4}
        far={4}
      />

      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={11}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={false}
      />
    </Canvas>
  );
}
