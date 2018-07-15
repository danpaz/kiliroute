(function() {
  var accessToken = 'pk.eyJ1IjoiZGFucGF6IiwiYSI6ImNqMjVpYmk5czAwN2sycXBjYmd0eGNrdjkifQ.WLg6LD184VYKYQPbW7NY7w';
  var scene = new THREE.Scene();
  var width  = document.getElementById('three').getBoundingClientRect().width;
  var height = document.getElementById('three').getBoundingClientRect().height;
  var min = Infinity;
  var max = -Infinity

  //add light
  var light = new THREE.DirectionalLight( 0xffffff, 0.75 );
  light.position.set(300,1600,0);
  light.castShadow = true;
  var dLight = 200;
  var sLight = dLight * 0.25;
  light.shadow.camera.right = sLight;
  light.shadow.camera.top = sLight;
  light.shadow.camera.near = dLight / 30;
  light.shadow.camera.far = dLight;
  light.shadow.mapSize.x = 1024 * 2;
  light.shadow.mapSize.y = 1024 * 2;

  scene.add(light);

  var world = new THREE.Group();
  world.rotation.x =- Math.PI/2;

  scene.add(world);

  var renderer = new THREE.WebGLRenderer({alpha:true, antialias:false});
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  document.getElementById('three')
      .appendChild(renderer.domElement);

  var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
  camera.position.y = 600;
  camera.position.z = 600;

  var controls = new THREE.OrbitControls(camera, renderer.domElement); 

  var canvas = document.getElementById('myCanvas');
  var context = canvas.getContext('2d');
  var cols, rows;

  const loadTile = () => {
      const url = `https://a.tiles.mapbox.com/v4/mapbox.terrain-rgb/10/617/520@2x.pngraw?access_token=${accessToken}`
      return fetch(url)
        .then(function(response) {
          return response.blob()
        })
        .then(function(blob) {
          return URL.createObjectURL(blob);
        });
  }

  function getImageData(imgUrl) {
    return new Promise((res, rej) => {
      var imageObj = new Image();

      imageObj.onload = () => {
          context.drawImage(imageObj, 0, 0);
          res(context.getImageData(0, 0, canvas.width, canvas.height));
      }

      imageObj.src = imgUrl;
    });
  }

  //convert ndarray of RGB values into an elevation number
  function getElevations(pixels){

    cols = pixels.width;
    rows = pixels.height;
    var channels = 4;

    var output = [];

    var upsampledResolution = {};

    for (var r = 0; r < rows; r++){

      var lastElev = null;
      var consecutiveCount = 0;

      for (var c = 0; c < cols; c++){
        var currentPixelIndex = (r*cols+c) * channels;
        var R = pixels.data[currentPixelIndex];
        var G = pixels.data[currentPixelIndex+1];
        var B = pixels.data[currentPixelIndex+2];

        var elev = (R * 256 * 256 + G * 256 + B)/10-10000;
        if (elev<min) min = elev
        if (elev>max) max = elev

        if (elev === lastElev) consecutiveCount++

        else {
          if (upsampledResolution[consecutiveCount]) upsampledResolution[consecutiveCount]++
          else upsampledResolution[consecutiveCount] = 1
          consecutiveCount = 0
        }

        lastElev = elev
        output.push(elev)
      }

    }
    return output;
  }

  function getTexture() {
    return new Promise((res, rej) => {
      var satelliteUrl = `https://api.mapbox.com/v4/mapbox.satellite/37.346846600934384,-3.0864321822865963,11/661x354@2x.png?access_token=${accessToken}`
      var texture = new THREE.TextureLoader()
        .load(
            satelliteUrl,
            function onSuccess(t) {
              res(new THREE.MeshBasicMaterial({map: t}));
            },
            undefined,
            function onError(e) {
              console.error(e);
              rej(e);
            }
        );
    });
  }

  function makeMesh(elevs) {
    return getTexture()
      .then((texture) => {
        var geometry = new THREE.PlaneGeometry(cols, rows, cols-1, rows-1);
        for (var i = 0; i < geometry.vertices.length; i++) geometry.vertices[i].z = meterToPx(elevs[i]);
        return new THREE.Mesh(geometry, texture);
      })
  }

  function meterToPx(m){    
    var zoom = 11;
    var tileSize = 512;
    function mPerPixel(latitude) {
      return Math.abs(
        40075000 * Math.cos(latitude*Math.PI/180) / (Math.pow(2, zoom) * tileSize )
      );
    }
    //var avgLat = (state.bbox[0][1]+state.bbox[1][1])/2;
    var avgLat = -3.0864321822865963;
    return (m-min) / mPerPixel(avgLat);
  }

  function addToScene(mesh) {
    console.log('mesh', mesh);
    world.add(mesh);
  }

  function render() {
    controls.update();

    requestAnimationFrame( render );
    renderer.render( scene, camera );
  }

  // init
  function onWindowResize() {
      var threeWidth = document.querySelector('#three').offsetWidth;
      camera.aspect = threeWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize( threeWidth, window.innerHeight );
  }
  window.addEventListener( 'resize', onWindowResize, false );

  loadTile()
    .then(getImageData)
    .then(getElevations)
    .then(makeMesh)
    .then(addToScene)
    .then(render)
    .catch((err) => {
      console.log(err); 
    });

})();
