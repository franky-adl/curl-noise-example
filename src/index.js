// ThreeJS and Third-party deps
import * as THREE from "three"
import * as dat from 'dat.gui'
import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer"

// Core boilerplate code deps
import { createCamera, createRenderer, runApp, updateLoadingProgressBar, getDefaultUniforms } from "./core-utils"

// Other deps
import vertexShader from './shaders/vertex.glsl'
import fragmentShader from './shaders/fragment.glsl'
import SimulationFragment from './shaders/simFragment.glsl'

global.THREE = THREE
// previously this feature is .legacyMode = false, see https://www.donmccurdy.com/2020/06/17/color-management-in-threejs/
// turning this on has the benefit of doing certain automatic conversions (for hexadecimal and CSS colors from sRGB to linear-sRGB)
THREE.ColorManagement.enabled = true

/**************************************************
 * 0. Tweakable parameters for the scene
 *************************************************/
// Texture width/height for simulation
const FBO_WIDTH = 256
const FBO_HEIGHT = 256
// this controls the fps of the gpgpu renderer, thus controls the speed of the animation
// unit in seconds
const FPSInterval = 1/60

const params = {
  // general scene params
  radius: 0.8
}
// Set I - Calmer curl field, best with flying colors
const setI = {a: 0.13, b: 5.0, c: 0.4, d: 0.0075}
// Set II - Wilder curl field
const setII = {a: 0.12, b: 7.0, c: 1.5, d: 0.0075}
// Set III - Ghostly tango, best with pure white
const setIII = {a: 0.23, b: 3.3, c: 0.3, d: 0.0161}

// switch between sets here
const set = setI
const uniforms = {
  ...getDefaultUniforms(),
  radius: { value: params.radius },
  circularForceFactor: { value: set.a },
  curlPatternScale: { value: set.b },
  curlVaryingSpeed: { value: set.c },
  curlForceFactor: { value: set.d }
}


/**************************************************
 * 1. Initialize core threejs components
 *************************************************/
// Create the scene
let scene = new THREE.Scene()

// Create the renderer via 'createRenderer',
// 1st param receives additional WebGLRenderer properties
// 2nd param receives a custom callback to further configure the renderer
let renderer = createRenderer({ antialias: true }, (_renderer) => {
  // best practice: ensure output colorspace is in sRGB, see Color Management documentation:
  // https://threejs.org/docs/#manual/en/introduction/Color-management
  _renderer.outputColorSpace = THREE.SRGBColorSpace
})

// Create the camera
// Pass in fov, near, far and camera position respectively
let camera = createCamera(45, 1, 1000, { x: 0, y: 0, z: 4 })

/**************************************************
 * 2. Build your scene in this threejs app
 * This app object needs to consist of at least the async initScene() function (it is async so the animate function can wait for initScene() to finish before being called)
 * initScene() is called after a basic threejs environment has been set up, you can add objects/lighting to you scene in initScene()
 * if your app needs to animate things(i.e. not static), include a updateScene(interval, elapsed) function in the app as well
 *************************************************/
let app = {
  async initScene() {
    // OrbitControls
    this.controls = new OrbitControls(camera, renderer.domElement)
    this.controls.enableDamping = true

    this.delta = 0

    await updateLoadingProgressBar(0.1)

    // Creates the gpu computation class and sets it up
    this.gpuCompute = new GPUComputationRenderer( FBO_WIDTH, FBO_HEIGHT, renderer )
    if ( renderer.capabilities.isWebGL2 === false ) {
      this.gpuCompute.setDataType( THREE.HalfFloatType )
    }

    const posmap = this.gpuCompute.createTexture()
    const infomap = this.gpuCompute.createTexture()
    this.fillTexture( posmap )
    this.fillInfoTexture( infomap )
    this.posmapVariable = this.gpuCompute.addVariable( 'posmap', SimulationFragment, posmap )
    this.gpuCompute.setVariableDependencies( this.posmapVariable, [ this.posmapVariable ] )
    this.posmapVariable.material.uniforms[ 'infomap' ] = { value: infomap }
    this.posmapVariable.material.uniforms[ 'u_time' ] = uniforms.u_time
    this.posmapVariable.material.uniforms[ 'radius' ] = uniforms.radius
    this.posmapVariable.material.uniforms[ 'circularForceFactor' ] = uniforms.circularForceFactor
    this.posmapVariable.material.uniforms[ 'curlPatternScale' ] = uniforms.curlPatternScale
    this.posmapVariable.material.uniforms[ 'curlVaryingSpeed' ] = uniforms.curlVaryingSpeed
    this.posmapVariable.material.uniforms[ 'curlForceFactor' ] = uniforms.curlForceFactor

    const error = this.gpuCompute.init()
    if ( error !== null ) {
      console.error( error )
    }

    this.count = FBO_WIDTH * FBO_HEIGHT
    let geometry = new THREE.BufferGeometry()
    let positions = new Float32Array(this.count * 3)
    let uv = new Float32Array(this.count * 2)
    for (let i = 0; i < FBO_WIDTH; i++) {
      for (let j = 0; j < FBO_HEIGHT; j++) {
        let index = (i + j * FBO_WIDTH)

        positions[index * 3 + 0] = Math.random() - 0.5
        positions[index * 3 + 1] = Math.random() - 0.5
        positions[index * 3 + 2] = 0
        uv[index * 2 + 0] = i / FBO_WIDTH
        uv[index * 2 + 1] = j / FBO_HEIGHT
      }
      
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2))

    let material = new THREE.ShaderMaterial({
      uniforms: {
        ...uniforms,
        posMap: { value: null },
        infoMap: { value: infomap },
      },
      transparent: true,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    })

    this.points = new THREE.Points(geometry, material)
    scene.add(this.points)

    // GUI controls
    const gui = new dat.GUI()
    gui.add(uniforms.circularForceFactor, "value", 0.0, 2.0, 0.01).name("Circular Force Factor")
    gui.add(uniforms.curlPatternScale, "value", 0.1, 20.0, 0.1).name("Curl Pattern Scale")
    gui.add(uniforms.curlVaryingSpeed, "value", 0.1, 10.0, 0.1).name("Curl Varying Speed")
    gui.add(uniforms.curlForceFactor, "value", 0.0001, 0.1, 0.0001).name("Curl Force Factor")

    // Stats - show fps
    this.stats1 = new Stats()
    this.stats1.showPanel(0) // Panel 0 = fps
    this.stats1.domElement.style.cssText = "position:absolute;top:0px;left:0px;"
    // this.container is the parent DOM element of the threejs canvas element
    this.container.appendChild(this.stats1.domElement)

    await updateLoadingProgressBar(1.0, 100)
  },
  fillTexture( texture ) {
    const pixels = texture.image.data

    let p = 0
    for ( let j = 0; j < FBO_HEIGHT; j ++ ) {
      for ( let i = 0; i < FBO_WIDTH; i ++ ) {
        let theta = Math.random() * Math.PI * 2
        let r = params.radius

        pixels[ p + 0 ] = r * Math.cos(theta)
        pixels[ p + 1 ] = r * Math.sin(theta)
        pixels[ p + 2 ] = 1.
        pixels[ p + 3 ] = 1.

        p += 4
      }
    }
  },
  fillInfoTexture( texture ) {
    const pixels = texture.image.data

    let p = 0
    for ( let j = 0; j < FBO_HEIGHT; j ++ ) {
      for ( let i = 0; i < FBO_WIDTH; i ++ ) {
        // speeds, scatter them in opposite directions
        pixels[ p + 0 ] = (0.01 + 0.005 * Math.random()) * ( Math.random() < 0.8 ? -1 : 1 ) * 10.
        // spare randomness not in use
        pixels[ p + 1 ] = Math.random()
        // radii fluctuation
        pixels[ p + 2 ] = 0.08 * Math.random() - 0.04
        // particle size
        pixels[ p + 3 ] = 0.5 + Math.random()

        p += 4
      }
    }
  },
  // @param {number} interval - time elapsed between 2 frames
  // @param {number} elapsed - total time elapsed since app start
  updateScene(interval, elapsed) {
    this.controls.update()
    this.stats1.update()

    // this controls the fps of the gpgpu renderer, thus controls the speed of the animations and be consistent across devices of various fps
    this.delta += interval
    if (this.delta > FPSInterval) {
      // Do the gpu computation
      this.gpuCompute.compute()
      this.delta = this.delta % FPSInterval
    }

    // use the computed fbo texture below
    this.points.material.uniforms['posMap'].value = this.gpuCompute.getCurrentRenderTarget( this.posmapVariable ).texture
  }
}

/**************************************************
 * 3. Run the app
 * 'runApp' will do most of the boilerplate setup code for you:
 * e.g. HTML container, window resize listener, mouse move/touch listener for shader uniforms, THREE.Clock() for animation
 * Executing this line puts everything together and runs the app
 * ps. if you don't use custom shaders, pass undefined to the 'uniforms'(2nd-last) param
 * ps. if you don't use post-processing, pass undefined to the 'composer'(last) param
 *************************************************/
runApp(app, scene, renderer, camera, true, uniforms)
