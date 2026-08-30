// js/office/materials.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';

// Materials for Office
export const floorMat = new THREE.MeshStandardMaterial({ color: 0x353a45, roughness: 0.85, metalness: 0.1 });

export const accentMat = new THREE.MeshStandardMaterial({ color: 0x4772b3, roughness: 0.6 });
export const woodDeskMat = new THREE.MeshStandardMaterial({ color: 0xdfd4c0, roughness: 0.6 });
export const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.5 });
export const metalDeskMat = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.4, metalness: 0.8 });
export const chairMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 0.7 });
export const screenMat = new THREE.MeshStandardMaterial({ color: 0x101520, emissive: 0x3a7bd5, emissiveIntensity: 0.6, roughness: 0.2 });
export const rackMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.3, metalness: 0.9 });

export const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.85 });
export const steelMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, roughness: 0.25, metalness: 0.85 });
export const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xbfe0ea, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1
});
