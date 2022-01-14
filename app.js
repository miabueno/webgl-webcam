const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');

// ------------- FACE DETECTION -----------------

function detectFace(results) {
    
    const image = new Image();
    image.src = "./images/d.jpeg";
    image.onload = () => {
            render(results.image);
    };

    // TODO: Slap images on

    // if (results.multiFaceLandmarks) {
    //         for (const landmarks of results.multiFaceLandmarks) {
    //         }
    // }
}

const faceMesh = new FaceMesh({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
}});
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(detectFace);
    
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({image: videoElement});
    },
    width: 1280,
    height: 720
});
camera.start();

// ------------- WEBGL HELPERS -----------------

function createProgram(gl, vertexShader, fragmentShader) {

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) return program;

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) return shader;
    
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

// ------------- RENDERING -----------------

function render(image) {
    
    // initialise gl context        
    /** @type {WebGLRenderingContext} */
    const gl = canvasElement.getContext('webgl');

    try {
            if (!gl) throw "Browser does not support webgl";
    } catch (error) {
            console.log(`error: ${error}`);
            alert('Unable to initialise Webgl');
    }

    const vertexShaderSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        
        uniform vec2 u_resolution;
        
        varying vec2 v_texCoord;
        
        void main() {
            // convert the rectangle from pixels to 0.0 to 1.0
            vec2 zeroToOne = a_position / u_resolution;
            
            // convert from 0->1 to 0->2
            vec2 zeroToTwo = zeroToOne * 2.0;
            
            // convert from 0->2 to -1->+1 (clipspace)
            vec2 clipSpace = zeroToTwo - 1.0;
            
            gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            
            // pass the texCoord to the fragment shader
            // The GPU will interpolate this value between points.
            v_texCoord = a_texCoord;
        }
    `;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

    const fragmentShaderSource = `
        precision mediump float;

        // our texture
        uniform sampler2D u_image;
        
        // the texCoords passed in from the vertex shader.
        varying vec2 v_texCoord;
        
        void main() {
            gl_FragColor = texture2D(u_image, v_texCoord);
        }
    `;
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    // setup GLSL program
    const program = createProgram(gl, vertexShader, fragmentShader);
    
    // look up where the vertex data needs to go.
    const positionLocation = gl.getAttribLocation(program, `a_position`);
    const texCoordLocation = gl.getAttribLocation(program, `a_texCoord`);
    
    // Create a buffer * bind
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    setRectangle(gl, 0, 0, image.width, image.height);

    const texCoordBufferData = [
        0.0,  0.0,
        1.0,  0.0,
        0.0,  1.0,
        0.0,  1.0,
        1.0,  0.0,
        1.0,  1.0,
    ];
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoordBufferData), gl.STATIC_DRAW);

    // Create texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    
    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // lookup uniforms
    const resolutionLocation = gl.getUniformLocation(program, `u_resolution`);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.useProgram(program);

    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

}

function setRectangle(gl, x, y, width, height) {
    const x1 = x;
    const x2 = x + width;
    const y1 = y;
    const y2 = y + height;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2,
    ]), gl.STATIC_DRAW);
}
