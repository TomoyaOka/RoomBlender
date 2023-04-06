import * as THREE from "three";
import { gsap, Power4 } from "gsap";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

/*-- 通常のBlender用 --*/
import fragment from "./shaders/objBlenderFrag.glsl?raw";
import vertex from "./shaders/objBlenderVertex.glsl?raw";

/*-- BG用 --*/
import fragment02 from "./shaders/bgFragment.glsl?raw";
import vertex02 from "./shaders/bgVertex.glsl?raw";

/*--  --*/
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DotScreenShader } from "./CustomShader";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

// reference :
// https://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/

class App {
  /**
   * レンダー
   */
  static get RENDERER_SETTING() {
    return {
      clearColor: 0x111111,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  /**
   * マテリアル
   */
  static get MATERIAL_SETTING() {
    return {
      color: 0xffffff,
    };
  }
  /**
   * カメラ
   */
  static get CAMERA_PARAM() {
    return {
      fovy: 60,
      aspect: window.innerWidth / window.innerHeight,
      near: 0.01,
      far: 200000.0,
      x: 0.0,
      y: 0.0,
      z: 15,
      lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
    };
  }
   /**
   * ライトの動き
   */
   static get LIGHT_SETTING() {
    return {
      angle: 0,
      radius:10
    };
  }

  /**
   * @constructor
   */
  constructor() {
    this.renderer;
    this.scene;
    this.camera;
    this.geometory;
    this.material;
    this.mesh;
    this.array = [];
    this.group;
    this.controls;
    this.composer;
    this.model;
    this.ambientLight;
    this.directionalLight;
    this.gltf;
    this.loader;
    this.texture;
    this.Geometry = [];
    this.raycaster;
    this.sampler;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.backgroundGroup = new THREE.Group();
    this.renderTarget;

    this.angle= 0;
    this.radius = 200;

    this.render = this.render.bind(this);
  }

  _setRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(0xcccccc, 0.0);
    this.renderer.setSize(App.RENDERER_SETTING.width, App.RENDERER_SETTING.height);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMappingExposure = 1.75;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // this.renderer.autoClear = false;
    const canvas = document.querySelector("#render");
    canvas.appendChild(this.renderer.domElement);
    //////////////////
    this.mainRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
  }

  _setScene() {
    this.scene = new THREE.Scene();
  }

  _setCamera() {
    this.camera = new THREE.PerspectiveCamera(App.CAMERA_PARAM.fovy, App.CAMERA_PARAM.aspect, App.CAMERA_PARAM.near, App.CAMERA_PARAM.far);
    this.camera.position.set(App.CAMERA_PARAM.x, App.CAMERA_PARAM.y, App.CAMERA_PARAM.z);
    this.camera.lookAt(App.CAMERA_PARAM.lookAt);
    this.camera.updateProjectionMatrix();
    this.controls = new OrbitControls(this.camera, document.body);
  }

  _setLight() {
    this.ambientLight = new THREE.AmbientLight(0xfffffff, 0.1);

    this.directionalLight = new THREE.DirectionalLight(0xfffffff, 0.5);
    this.directionalLight.position.set(-1.0, 110.0, 0.0);
    this.directionalLight.castShadow = true;

    this.directionalLight02 = new THREE.DirectionalLight(0xffffff, 0.92);
    this.directionalLight02.position.set(0.0, 10.0, 5.0);
    this.directionalLight02.castShadow = true;

    this.scene.add(this.ambientLight);
    this.scene.add(this.directionalLight);
    this.scene.add(this.directionalLight02);
  }

  getGeometryData() {
    return new Promise((resolve) => {
      const gltfPath = "./room.glb";
      const loader = new GLTFLoader();

      loader.load(gltfPath, (gltf) => {
        this.gltf = gltf;
        //モデルの情報を格納
        this.gltf.scene.traverse((obj)=>{
          if(obj.isMesh) {
            this.sampler = new MeshSurfaceSampler(obj).build();
          }
          if(obj.isGroup) {}
        })
        resolve();
      });

    });
  }

  _setBlenderModel() {
    this.all = new THREE.Group();
    this.group = []
    this.gltf.scene.traverse((obj) => {
      if (obj.isMesh) {
        // メッシュオブジェクトを表示する
        this.blenderGeometry = obj.geometry;
        const uniforms = {
          uColor: { value: new THREE.Color(0xffffff) },
          uTime: { value: 0.0 },
        };
        this.blenderMaterial = new THREE.ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: fragment,
          lights: true,
          uniforms: { ...THREE.UniformsLib.lights, ...uniforms },
          side: THREE.DoubleSide,
        });
        this.blenderMesh = new THREE.Mesh(this.blenderGeometry, this.blenderMaterial);
 
        // モデルの位置情報を取得して、表示位置を調整する
        // this.blenderMesh.position.copy(obj.position);

        this.group.push(this.blenderMesh);
        this.scene.add(this.blenderMesh);
      }

    });
    
    console.log(this.group)
    this.group.forEach(obj=>{
      obj.position.y = -1;
      obj.rotation.x = 0.2;
      if (navigator.userAgent.match(/iPhone|Android.+Mobile/)) {
        obj.scale.x = 0.5;
        obj.scale.y = 0.5;
        obj.scale.z = 0.5;
      } 
    })
  }

  init() {
    this._setRenderer();
    this._setScene();
    this._setCamera();
    this._setLight();
    this._setBlenderModel();
  }

  render() {
    requestAnimationFrame(this.render);
    this.controls.update();

    this.angle += 0.01;
    const x = this.radius * Math.cos(this.angle);
    const z = this.radius * Math.sin(this.angle);
    this.directionalLight.position.set(x, 200, z);
    this.directionalLight02.position.set(-x, 200, z);

  

    this.group.forEach(obj=>{
      obj.material.uniforms.uTime.value += 0.005;

      obj.rotation.x += 0.005;
      obj.rotation.y += 0.005;

    })



    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.getGeometryData().then(() => {
    app.init();
    app.render();
    window.addEventListener("resize", () => {
      app.onResize();
    });
  });
});

export {};
