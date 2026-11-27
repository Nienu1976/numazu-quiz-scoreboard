// 既存の 3D モジュール（textures.js / models.js）は window.THREE を前提とするため、先に公開する。
import * as THREE from 'three';
(window as unknown as { THREE: typeof THREE }).THREE = THREE;
