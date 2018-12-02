global.THREE = require('three');
var OrbitControls = require('./include/OrbitControls.js');
var route = require('./include/route');
var accessToken = 'pk.eyJ1IjoiZGFucGF6IiwiYSI6ImNqMjVpYmk5czAwN2sycXBjYmd0eGNrdjkifQ.WLg6LD184VYKYQPbW7NY7w';

var scene = new THREE.Scene();
var width  = document.getElementById('three').getBoundingClientRect().width;
var height = document.getElementById('three').getBoundingClientRect().height;
var min = Infinity;
var max = -Infinity;
var corners = [[37.569509,-3.226477],[37.109495,-2.955422]];

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
canvas.height = 395
canvas.width = 670
// canvas.height = Math.abs(lr[1] - ul[1]);
// canvas.width = Math.abs(lr[0] - ul[0]);
var context = canvas.getContext('2d');
var cols, rows;

const tiles = [
  {
    url: `https://a.tiles.mapbox.com/v4/mapbox.terrain-rgb/10/617/520@2x.pngraw?access_token=`,
    px: -285,
    py: -210
  },
  {
    url: `https://a.tiles.mapbox.com/v4/mapbox.terrain-rgb/10/618/520@2x.pngraw?access_token=`,
    px: 227,
    py: -210
  },
  {
    url: `https://c.tiles.mapbox.com/v4/mapbox.terrain-rgb/10/617/521@2x.pngraw?access_token=`,
    px: -285,
    py: 302
  },
  {
    url: `https://c.tiles.mapbox.com/v4/mapbox.terrain-rgb/10/618/521@2x.pngraw?access_token=`,
    px: 227,
    py: 302
  }
];

const loadTile = (tile) => {
    tile.url += accessToken;
    return fetch(tile.url)
      .then((res) => res.blob())
      .then((blob) => {
        return new Promise((res, rej) => {
          var imageObj = new Image();

          imageObj.onload = () => {
              context.drawImage(imageObj, tile.px, tile.py);
              res();
          }

          imageObj.src = URL.createObjectURL(blob);
        });
      });
}


//convert ndarray of RGB values into an elevation number
function getElevations(pixels){
  cols = pixels.width;
  rows = pixels.height;
  var channels = 4;

  var output = [];

  for (var r = 0; r < rows; r++){
    for (var c = 0; c < cols; c++){
      var currentPixelIndex = (r*cols+c) * channels;
      var R = pixels.data[currentPixelIndex];
      var G = pixels.data[currentPixelIndex+1];
      var B = pixels.data[currentPixelIndex+2];

      var elev = (R * 256 * 256 + G * 256 + B)/10-10000;
      if (elev<min) min = elev
      if (elev>max) max = elev

      output.push(elev)
    }

  }
  return output;
}

function getTexture() {
  return new Promise((res, rej) => {
    var satelliteUrl = `https://api.mapbox.com/v4/mapbox.satellite/37.339472620806845,-3.0909743575721165,11/512x256@2x.png?access_token=${accessToken}`
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

// function coordinateToIndex(coordinate, elevs) {

// }

function vertex(point, elevs) {
  var x = cols * (-(point[0] - corners[1][0])/(corners[1][0]-corners[0][0])) - (285 * 670/512);
  var y = rows * ((point[1] - corners[1][1])/(corners[1][1]-corners[0][1])) + (210);

  var xz = rows * ((point[1] - corners[1][1])/(corners[1][1]-corners[0][1]));
  var yz = (point[0] - corners[1][0]) * cols;
  console.log(xz*yz);
  // var idx = Math.round(x*y);
  // var z = meterToPx(elevs[idx]);
  var z = 100;
  var vector = new THREE.Vector3(x, y, z);

  return vector;
}

function makeMesh(elevs) {
  return getTexture()
    .then((texture) => {
      console.log(rows, cols, elevs.length);
      var geometry = new THREE.PlaneGeometry(cols, rows, cols-1, rows-1);
      var lineGeometry = new THREE.Geometry();
      var lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });

      for (var i = 0; i < geometry.vertices.length; i++) {
        geometry.vertices[i].z = meterToPx(elevs[i]);
      }

      for (var j = 0; j < route.features[0].geometry.coordinates.length; j++) {
        var point = route.features[0].geometry.coordinates[j];
        lineGeometry.vertices.push(vertex(point, elevs));
      }

      geometry.computeVertexNormals();

      var line = new THREE.LineSegments(lineGeometry, lineMaterial);
      var satellite = new THREE.Mesh(geometry, texture);

      world.add(line);
      world.add(satellite);
      return;
    });
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

return Promise.all(tiles.map(loadTile))
  .then(() => context.getImageData(0, 0, canvas.width, canvas.height))
  .then(getElevations)
  .then((elevs) => {
    return makeMesh(elevs)
      // .then(addToScene)
      .then(render)
  })
  .catch((err) => {
    console.log(err);
  });
