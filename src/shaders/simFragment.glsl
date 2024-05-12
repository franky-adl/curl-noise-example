#pragma glslify: curl = require('./curlNoise_perlin3D.glsl')

#define PI 3.1415926538

uniform sampler2D infomap;
uniform float u_time;
uniform float radius;
uniform float circularForceFactor;
uniform float curlPatternScale;
uniform float curlVaryingSpeed;
uniform float curlForceFactor;

void main()	{
    // The size of the computation (sizeX * sizeY) is defined as 'resolution' automatically in the shader.
    // sizeX and sizeY are passed as params when you make a new GPUComputationRenderer instance.
    vec2 cellSize = 1.0 / resolution.xy;

    // gl_FragCoord is in pixels (coordinates range from 0.0 to the width/height of the window,
    // note that the window isn't the visible one on your browser here, since the gpgpu renders to its virtual screen
    // thus the uv still is 0..1
    vec2 uv = gl_FragCoord.xy * cellSize;
    vec4 pos = texture2D( posmap, uv );
    vec4 info = texture2D( infomap, uv );

    // info.x = speed of the particles
    float targetAngle = atan(pos.y, pos.x) + info.x;
    // introducing radius fluctuations via cosine and info.z
    float targetRadius = radius + (cos(targetAngle * 2. + 2.) + 1.) * info.z;

    // using a curl that returns 2D force field that takes a 3D perlin noise, we feed time to the z component for the perlin noise
    // such that the curl pattern changes over time, preventing particles ending up in deadzones never coming out
    vec2 curled = vec2(0.);
    // info.w = particle size, with the randomness there should be half over 1.0 pointSize
    // we apply the same curl function but with different time directions for the 2 batches of particles
    // thus resulting in different curl patterns for them
    if (info.w > 1.0) {
        curled = curl(vec3(pos.xy * curlPatternScale, u_time * curlVaryingSpeed)) * curlForceFactor;
    } else {
        curled = curl(vec3(pos.xy * curlPatternScale, -1. * u_time * curlVaryingSpeed)) * curlForceFactor;
    }
    vec3 targetPos = vec3(cos(targetAngle), sin(targetAngle), 0.0) * targetRadius;
    // new position = curl force + an eased/dampened force towards the target position
    pos.xy += curled.xy + (targetPos.xy - pos.xy) * circularForceFactor;

    gl_FragColor = pos;

}