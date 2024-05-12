#define TWO_PI 6.28318530718
#define PI 3.1415926538
uniform vec2 u_resolution;
varying float posAngle;
uniform float u_time;
varying vec4 info;

// https://www.shadertoy.com/view/ll2GD3
vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  // -PI < fadeAngle < PI
  float fadeAngle = mod(u_time * -2.5, TWO_PI) - PI;
  // -PI < posAngle * 2. < PI
  float angleDiff = abs(fadeAngle - posAngle * 2.);

  // if you want dynamic opacity, replace 1. with (cos(angleDiff) + 1.) / 2. + 0.1:
  // feed angle difference into cosine and do remapping such that the number can fluctuate between 0 to 1
  // add a base number to it so the opacity doesn't start from zero
  gl_FragColor = vec4(pal( info.x * 10., vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.10,0.20) ), 1.);

  // transform color from linear colorSpace to sRGBColorSpace
  // gl_FragColor = linearToOutputTexel( gl_FragColor );
}