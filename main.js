(function() {
  var accessToken = 'pk.eyJ1IjoiZGFucGF6IiwiYSI6ImNqMjVpYmk5czAwN2sycXBjYmd0eGNrdjkifQ.WLg6LD184VYKYQPbW7NY7w';
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
  var renderer = new THREE.WebGLRenderer();
  var controls = new THREE.OrbitControls( camera );
  var canvas = document.getElementById('myCanvas');
  var context = canvas.getContext('2d');
  var cols, rows;

  camera.position.z = 5;


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

  function getImageData(img) {
    return new Promise((res, rej) => {
      var imageObj = new Image();

      imageObj.onload = () => {
          context.drawImage(imageObj, 0, 0);
          res(context.getImageData(0, 0, canvas.width, canvas.height));
      }

      imageObj.src = img;
    });
  }

  //convert ndarray of RGB values into an elevation number
    function getElevations(pixels){

      cols = pixels.width;
      rows = pixels.height;
      var channels = 4;

      var min = Infinity;
      var max = -Infinity
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

  function addToScene(elevs) {
    return getTexture()
      .then((texture) => {
        var geometry = new THREE.PlaneGeometry(cols, rows, cols-1, rows-1);
        for (var i = 0; i < geometry.vertices.length; i++) geometry.vertices[i].z = meterToPx(elevs[i]);
        var mesh = new THREE.Mesh(geometry, texture);
      console.log(mesh);
        scene.add(mesh)        
      })
  }


  // init
  window.addEventListener( 'resize', onWindowResize, false );

  function onWindowResize() {
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
  }

  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  function render() {
    requestAnimationFrame( render );
    renderer.render( scene, camera );
  }
  

  loadTile()
    .then(getImageData)
    .then(getElevations)
    .then(addToScene)
    .then(() => render())
    .catch((err) => {
      console.log(err); 
    });


})();
