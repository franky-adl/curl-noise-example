uniform sampler2D posMap;
uniform sampler2D infoMap;
varying float posAngle;
varying vec4 info;

void main() {
    info = texture2D( infoMap, uv );
    vec4 pos = texture2D(posMap, uv);
    posAngle = atan(pos.y, pos.x);

    // modelMatrix transforms the coordinates local to the model into world space
    vec4 worldPos = modelMatrix * pos;
    // viewMatrix transform the world coordinates into the world space viewed by the camera (view space)
    vec4 mvPosition = viewMatrix * worldPos;

    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = info.w;
}