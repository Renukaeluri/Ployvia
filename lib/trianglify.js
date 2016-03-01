

var delaunay = require('delaunay-fast');
var seedrandom = require('seedrandom');
var chroma = require('chroma-js'); //PROBLEM: chroma.js is nearly 32k in size
var colorbrewer = require('./colorbrewer'); 

var Pattern = require('./pattern');

var defaults = {
  width: 600,                       
  height: 400,                     
  cell_size: 75,                    
  variance: 0.75,                   
  seed: null,                    
  x_colors: 'random',               
  y_colors: 'match_x',              
  palette: colorbrewer,             
  color_space: 'lab',               
  color_function: null,             
  stroke_width: 1.51             
};



function Trianglify(opts) {
  var rand;
  
  // apply defaults
  opts = _merge_opts(defaults, opts);

  // setup seedable RNG
  rand = seedrandom(opts.seed);

  // randomize colors if requested
  if (opts.x_colors === 'random') opts.x_colors = _random_from_palette();
  if (opts.y_colors === 'random') opts.y_colors = _random_from_palette();
  if (opts.y_colors === 'match_x') opts.y_colors = opts.x_colors;

  // some sanity-checking
  if (!(opts.width > 0 && opts.height > 0)) {
    throw new Error("Width and height must be numbers greater than 0");
  }

  if (opts.cell_size < 2) {
    throw new Error("Cell size must be greater than 2.");
  }

  // Setup the color gradient function
  var gradient;

  if (opts.color_function) {
    gradient = function(x, y) {
      return chroma(opts.color_function(x, y));
    };
  } else {
    var x_color = chroma.scale(opts.x_colors).mode(opts.color_space);
    var y_color = chroma.scale(opts.y_colors).mode(opts.color_space);
    gradient = function(x, y) {
      return chroma.interpolate(x_color(x), y_color(y), 0.5, opts.color_space);
    };
  }


  var width = opts.width;
  var height = opts.height;

  // How many cells we're going to have on each axis (pad by 2 cells on each edge)
  var cells_x = Math.floor((width + 4 * opts.cell_size) / opts.cell_size);
  var cells_y = Math.floor((height + 4 * opts.cell_size) / opts.cell_size);

  // figure out the bleed widths to center the grid
  var bleed_x = ((cells_x * opts.cell_size) - width)/2;
  var bleed_y = ((cells_y * opts.cell_size) - height)/2;

  // how much can out points wiggle (+/-) given the cell padding?
  var variance = opts.cell_size * opts.variance / 2;

  // Set up normalizers
  var norm_x = function(x) {
    return _map(x, [-bleed_x, width+bleed_x], [0, 1]);
  };

  var norm_y = function(y) {
    return _map(y, [-bleed_y, height+bleed_y], [0, 1]);
  };

  // generate a point mesh
  var points = _generate_points(width, height);

  // delaunay.triangulate gives us indices into the original coordinate array
  var geom_indices = delaunay.triangulate(points);

  // iterate over the indices in groups of three to flatten them into polygons, with color lookup
  var triangles = [];
  var lookup_point = function(i) { return points[i];};
  for (var i=0; i < geom_indices.length; i += 3) {
    var vertices = [geom_indices[i], geom_indices[i+1], geom_indices[i+2]].map(lookup_point);
    var centroid = _centroid(vertices);
    var color = gradient(norm_x(centroid.x), norm_y(centroid.y)).hex();
    triangles.push([color, vertices]);
  }
  return Pattern(triangles, opts);


  
  function _map(num, in_range, out_range ) {
    return ( num - in_range[0] ) * ( out_range[1] - out_range[0] ) / ( in_range[1] - in_range[0] ) + out_range[0];
  }

    
  function _generate_points(width, height) {

    var points = [];
    for (var i = - bleed_x; i < width + bleed_x; i += opts.cell_size) {
      for (var j = - bleed_y; j < height + bleed_y; j += opts.cell_size) {
        var x = i + opts.cell_size/2 + _map(rand(), [0, 1], [-variance, variance]);
        var y = j + opts.cell_size/2 + _map(rand(), [0, 1], [-variance, variance]);
        points.push([x, y].map(Math.floor));
      }
    }

    return points;
  }

  //triangles only!
  function _centroid(d) {
    return {
      x: (d[0][0] + d[1][0] + d[2][0])/3,
      y: (d[0][1] + d[1][1] + d[2][1])/3
    };
  }

  // select a random palette from colorbrewer
  function _random_from_palette() {
    if (opts.palette instanceof Array) {
      return opts.palette[Math.floor(rand()*opts.palette.length)];
    }

    var keys = Object.keys(opts.palette);
    return opts.palette[keys[Math.floor(rand()*keys.length)]];
  }

  // shallow extend (sort of) for option defaults
  function _merge_opts(defaults, options) {
    var out = {};

    // shallow-copy defaults so we don't mutate the input objects (bad)
    for (var key in defaults) {
      out[key] = defaults[key];
    }

    for (key in options) {
      if (defaults.hasOwnProperty(key)) {
        out[key] = options[key]; // override defaults with options
      } else {
        throw new Error(key+" is not a configuration option for Trianglify. Check your spelling?");
      }
    }
    return out;
  }

} //end of Trianglify function closure

// exports
Trianglify.colorbrewer = colorbrewer;
Trianglify.defaults = defaults;
module.exports = Trianglify;
