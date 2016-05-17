
// module to handle design data
// converts between boundry representation and gcode
// creates previews



DataHandler = {

  nums : [
    [[[1,0.17],[0.67,0],[0.33,0.17],[0.08,0.81],[0,1.5],[0.08,2.19],[0.33,2.83],[0.67,3],[1,2.83],[1.25,2.19],[1.33,1.5],[1.25,0.81],[1,0.17]]],
    [[[0,0.67],[0.67,0],[0.67,3]]],
    [[[0.09,0.33],[0,0.5]],[[0.09,0.33],[0.49,0.02],[1,0.09],[1.31,0.49],[1.24,1]],[[1.24,1],[0,3],[1.33,3]]],
    [[[0.67,0],[1.14,0.2],[1.33,0.67],[1.14,1.14],[0.67,1.33]],[[0.67,1.33],[0.33,1.33]],[[0.67,1.33],[1.14,1.53],[1.33,2]],[[1.33,2],[1.33,2.33]],[[1.33,2.33],[1.14,2.8],[0.67,3]],[[0.67,3],[0,3]],[[0,0],[0.67,0]]],
    [[[0.67,0],[0,2.33],[1.67,2.33]],[[1.17,3],[1.17,1.67]]],
    [[[1.33,0],[0,0],[0,1.33],[0.67,1.33]],[[0.67,1.33],[1.14,1.53],[1.33,2]],[[1.33,2],[1.33,2.33]],[[1.33,2.33],[1.14,2.8],[0.67,3]],[[0.67,3],[0,3]]],
    [[[1,0],[0.28,0.5],[0,1.33]],[[0,1.33],[0.67,1.33]],[[0.67,1.33],[1.14,1.53],[1.33,2]],[[1.33,2],[1.33,2.33]],[[1.33,2.33],[1.14,2.8],[0.67,3],[0.2,2.8],[0,2.33]],[[0,2.33],[0,1.33]]],
    [[[0,0.33],[0,0],[1.33,0],[0.67,3]]],
    [[[0.67,1.33],[1.14,1.14],[1.33,0.67],[1.14,0.2],[0.67,0],[0.2,0.2],[0,0.67],[0.2,1.14],[0.67,1.33]],[[1.33,2.33],[1.14,1.53],[0.67,1.33],[0.2,1.53],[0,2],[0.2,2.8],[0.67,3],[1.14,2.8],[1.33,2.33]]],
    [[[1.33,0.67],[1.14,0.2],[0.67,0],[0.2,0.2],[0,0.67]],[[0,0.67],[0,1]],[[0,1],[0.2,1.47],[0.67,1.67]],[[0.67,1.67],[1.33,1.67]],[[1.33,1.67],[1.33,0.67]],[[1.33,1.67],[1.05,2.5],[0.33,3]]],
    [[[1.33,0],[0,3]]]
  ],
  numsText : '0123456789/',

  paths_by_color : {},
// I:Raster Start
  rasters_by_color : {},
// I:Raster End
  passes : [],
  stats_by_color : {},
  date : {},

  clear : function() {
    this.paths_by_color = {};
// I:Raster Start
    this.rasters_by_color = {};
// I:Raster End
    this.passes = [];
    this.stats_by_color = {};
  },

  isEmpty : function() {
// C:Raster Start
//    return (Object.keys(this.paths_by_color).length == 0);
    return (Object.keys(this.paths_by_color).length == 0 && Object.keys(this.rasters_by_color).length == 0);
// C:Raster End
  },

  addChar : function(text, x, y, c) {

    var i = this.numsText.indexOf(c);
    for(var entity of this.nums[i]) {
      var newPath = [];
      for(var path of entity) {
        newPath.push([parseFloat(path[0] + x), parseFloat(path[1] + y)]);
      }
      text.push(newPath);
    }
  },

  setDateStamp : function(x, y) {

    var d = new Date();
    var s = d.getFullYear().toString() + '/' +
            ('0' + (d.getMonth() + 1).toString()).slice(-2) + '/' +
            ('0' + d.getDate().toString()).slice(-2);
    var text = [];
    for(var c of s) {
      this.addChar(text, x, y, c);
      x += 2;
    }
    return text;
  },
 
  

  // readers //////////////////////////////////

  setByPaths : function(paths_by_color) {
    // read boundaries
    // {'#000000':[[[x,y],[x,y], ..],[], ..], '#ffffff':[..]}
    this.clear();
    for (var color in paths_by_color) {
      var paths_src = paths_by_color[color];
// C:Raster Start
//      this.paths_by_color[color] = [];
      if (!this.rasters_by_color[color])
        this.rasters_by_color[color] = [];
      if (!this.paths_by_color[color])
        this.paths_by_color[color] = [];
// C:Raster End
      var paths = this.paths_by_color[color];
      for (var i=0; i<paths_src.length; i++) {
        var path = [];
        paths.push(path);
        var path_src = paths_src[i];
        for (var p=0; p<path_src.length; p++) {
          path.push([path_src[p][0], path_src[p][1]]);
        }
      }
    }
    // also calculate stats
    this.calculateBasicStats();
  },

  setByGcode : function(gcode) {
    // Read limited Gcode
    // G0, G00, G1, G01, G4, G04
    // G90, G91 (absolute, relative)
    // S, F, P
    // M0, M2, M3, M4, M5, M6
    // M80, M81, M82, M83, M84, M85
    // this.calculateBasicStats();
  },

  setByJson : function(strdata) {
    // read internal format
    // {'passes':{'colors':['#000000',..], 'feedrate':450, 'intensity':100},
    //  'paths_by_color':{'#000000':[[[x,y],[x,y], ..],[], ..], '#ffffff':[..]},
    //  'date':{'color':'#000000', x:0, y:0}
    // }
    this.clear();
    var data = JSON.parse(strdata);
    this.passes = data['passes'];
    this.paths_by_color = data['paths_by_color'];
// I:Raster Start
    this.rasters_by_color = data['rasters_by_color'];
// I:Raster End
    this.date = data['date'];
    
    if ('stats_by_color' in data) {
      this.stats_by_color = data['stats_by_color'];
    } else {
      this.calculateBasicStats();
    }

    if(this.date) {
      var text = this.setDateStamp(this.date.x, this.date.y);
      Array.prototype.push.apply(this.paths_by_color[this.date.color], text);
    }
  },

// I:Raster Start
  addRasters : function(rasters_by_color) {
    // read raster
    // {'#000000':[[x, y], [width, height], [pix_w, pix_h], data)], '#ffffff':[..]}
    for (var c in rasters_by_color) {
      var rasters_src = rasters_by_color[c];
      color = '#0000ff';
      if (!this.rasters_by_color[color])
        this.rasters_by_color[color] = [];
      if (!this.paths_by_color[color])
        this.paths_by_color[color] = [];
      this.rasters_by_color[color].push(rasters_src);
    }
    // also calculate stats
    this.calculateBasicStats();
  },
// I:Raster End

  // writers //////////////////////////////////

  getJson : function(exclude_colors) {
    // write internal format
    // exclude_colors is optional
    var paths_by_color = this.paths_by_color;
// I:Raster Start
    var rasters_by_color = this.rasters_by_color;
// I:Raster End
    if (!(exclude_colors === undefined)) {
      paths_by_color = {};
// I:Raster Start
      rasters_by_color = {};
      for (var color in this.rasters_by_color) {
        if (!(color in exclude_colors)) {
          rasters_by_color[color] = this.rasters_by_color[color];
        }
      }
// I:Raster End
      for (var color in this.paths_by_color) {
        if (!(color in exclude_colors)) {
          paths_by_color[color] = this.paths_by_color[color];
        }
      }
    }
    var data = {'passes': this.passes,
// C:Raster Start
//                'paths_by_color': paths_by_color}
                'paths_by_color': paths_by_color,
                'rasters_by_color': rasters_by_color}
// C:Raster End
    return JSON.stringify(data);
  },

  getGcode : function() {
    // write machinable gcode, organize by passes
    // header
    var glist = [];
    glist.push("G90\nM80\n");
    glist.push("G0F"+app_settings.max_seek_speed+"\n");
    // passes
    for (var i=0; i<this.passes.length; i++) {
      var pass = this.passes[i];
      var colors = pass['colors'];
      var feedrate = this.mapConstrainFeedrate(pass['feedrate']);
      var intensity = this.mapConstrainIntesity(pass['intensity']);
      var counts = parseInt(pass['counts']);
      glist.push("G1F"+feedrate+"\nS"+intensity+"\n");
      for (var c=0; c<colors.length; c++) {
        for(var l = 0; l < counts; l++) {
          var color = colors[c];
  // I:Raster Start
          // Rasters
          var rasters = null;
          if(this.rasters_by_color) rasters = this.rasters_by_color[color];
          if(rasters) {
            for (var k=0; k<rasters.length; k++) {
              var raster = rasters[k];

              // Raster Data
              var x1 = raster[0][0];
              var y1 = raster[0][1];
              var width = raster[1][0];
              var height = raster[1][1];
              var pixwidth = raster[2][0];
              var pixheight = raster[2][1];
              var data = raster[3];

              // Raster Variables
              var dot_pitch = width / pixwidth;

              // Calculate the offset based on acceleration and feedrate.
              var offset = 0.5 * feedrate * feedrate / 8000000;
              offset *= 1.1;  // Add some margin.
              if (offset < 5)
                offset = 5;

              // Setup the raster header
              glist.push("G00X"+x1.toFixed(app_settings.num_digits)+"Y"+y1.toFixed(app_settings.num_digits)+"\n");
              glist.push("G08P"+dot_pitch.toFixed(app_settings.num_digits+2)+"\n");
              glist.push("G08X"+offset.toFixed(app_settings.num_digits)+"Z0\n");
              glist.push("G08N0\n");

              // Calculate pixels per pulse
              var pppX = pixwidth / (width / dot_pitch);
              var pppY = pixheight / (height / dot_pitch);
              var reverse = 0;

              var LineCnt = 0;
              // Now for the raster data
              for (var y = 0; y < pixheight; y += pppY) {

                var line = Math.round(y) * pixwidth;
                var count = 0;
                var empty = 1;
                var raster = "";
                raster += "G8 D";

                if (reverse == 0) {
                  for (var x = 0; x < pixwidth; x += pppX) {
                    var pixel = line + Math.round(x);
                    if (data[pixel] == 0) {
                      raster += "1";
                        empty = 0;
                    } else {
                      raster += "0";
                    }
                    count++;
                    if (count % 70 == 0) {
                        raster += "\nG8 D";
                    }
                  }
                } else {
                  for (var x = pixwidth - 1; x >= 0; x -= pppX) {
                    var pixel = line + Math.round(x);
                    if (data[pixel] == 0) {
                      raster += "1";
                        empty = 0;
                    } else {
                      raster += "0";
                    }
                    count++;
                    if (count % 70 == 0) {
                        raster += "\nG8 D";
                    }
                  }
                }
                if (empty == 0) {
                    if (reverse == 0) {
                      glist.push("G8 R0\n");
                    reverse = 1;
                    } else {
                      glist.push("G8 R1\n");
                    reverse = 0;
                    }
                    glist.push(raster + "\n");
                  glist.push("G8 N0\n");
                }
                else {
    // C:刻印不具合修正 Start
                    glist.push("G00X"+(x1).toFixed(app_settings.num_digits)+"Y"+(y1 + (dot_pitch * LineCnt)).toFixed(app_settings.num_digits)+"\n");
                    reverse = 0;
    //                if (reverse == 0) {
    //		          glist.push("G00X"+(x1).toFixed(app_settings.num_digits)+"Y"+(y1 + (dot_pitch * LineCnt)).toFixed(app_settings.num_digits)+"\n");
    //                } else {
    //		          glist.push("G00X"+(x1 + width).toFixed(app_settings.num_digits)+"Y"+(y1 + (dot_pitch * LineCnt)).toFixed(app_settings.num_digits)+"\n");
    //                }
    // C:刻印不具合修正 End
                }
                LineCnt++;
              }
            }
          }
          // Paths
  // I:Raster End
          var paths = this.paths_by_color[color];
          for (var k=0; k<paths.length; k++) {
            var path = paths[k];
            if (path.length > 0) {
              var vertex = 0;
              var x = path[vertex][0];
              var y = path[vertex][1];
              glist.push("G0X"+x.toFixed(app_settings.num_digits)+
                           "Y"+y.toFixed(app_settings.num_digits)+"\n");
              for (vertex=1; vertex<path.length; vertex++) {
                var x = path[vertex][0];
                var y = path[vertex][1];
                glist.push("G1X"+x.toFixed(app_settings.num_digits)+
                             "Y"+y.toFixed(app_settings.num_digits)+"\n");
              }
            }      
          }
        }
      }
    }
    // footer
    glist.push("M81\nS0\nG0X0Y0F"+app_settings.max_seek_speed+"\n");
    // alert(JSON.stringify(glist.join('')))
    return glist.join('');
  },

  getBboxGcode : function() {
    if (!('_all_' in this.stats_by_color)) {
      this.calculateBasicStats();
    }
    var bbox = this.stats_by_color['_all_']['bbox'];
    var glist = [];
    glist.push("G90\n");
    glist.push("G0F"+app_settings.max_seek_speed+"\n");
    glist.push("G00X"+bbox[0].toFixed(3)+"Y"+bbox[1].toFixed(3)+"\n");
    glist.push("G00X"+bbox[2].toFixed(3)+"Y"+bbox[1].toFixed(3)+"\n");
    glist.push("G00X"+bbox[2].toFixed(3)+"Y"+bbox[3].toFixed(3)+"\n");
    glist.push("G00X"+bbox[0].toFixed(3)+"Y"+bbox[3].toFixed(3)+"\n");
    glist.push("G00X"+bbox[0].toFixed(3)+"Y"+bbox[1].toFixed(3)+"\n");
    glist.push("G0X0Y0F"+app_settings.max_seek_speed+"\n");
    return glist.join('');
  },



  // rendering //////////////////////////////////


  draw : function (canvas, scale, exclude_colors) { 
    // draw any path used in passes
    // exclude_colors is optional
    canvas.background('#ffffff');
    canvas.noFill();
    var x_prev = 0;
    var y_prev = 0;
// I:Raster Start
    // rasters
    for (var color in this.rasters_by_color) {
      if (exclude_colors === undefined || !(color in exclude_colors)) {
        var rasters = this.rasters_by_color[color];
        if (rasters) {
          for (var k=0; k<rasters.length; k++) {
            var raster = rasters[k];
            var x1 = raster[0][0]*scale;
            var y1 = raster[0][1]*scale;
            var width = raster[1][0]*scale;
            var height = raster[1][1]*scale;
            var pixwidth = raster[2][0];
            var pixheight = raster[2][1];
            var data = raster[3];

            // For rendering, use 1 pixel per mm (coarse) and an arbitrary offset to speed things up.
            var ppmmX = pixwidth / width;
            var ppmmY = pixheight / height;

            canvas.stroke('#aaaaaa');
            canvas.line(x_prev, y_prev, x1, y1);
            for (var y = y1; y < y1 + height; y++) {
              var line = Math.floor(ppmmY * (y-y1)) * pixwidth;
              for (var x=x1; x < x1 + width; x++) {
                var pixel = Math.floor(line + (x - x1) * ppmmX);
                if (data[pixel] == 255)
                  canvas.stroke('#eeeeee');
                else
                  canvas.stroke(color);
                canvas.line(x, y, x+1, y);
              }
            }
            x_prev = x1 + width;
            y_prev = y1 + height;
          }
        }
      }
    }
    // paths
// I:Raster End
    for (var color in this.paths_by_color) {
      if (exclude_colors === undefined || !(color in exclude_colors)) {
        var paths = this.paths_by_color[color];
        for (var k=0; k<paths.length; k++) {
          var path = paths[k];
          if (path.length > 0) {
            var x = path[0][0]*scale;
            var y = path[0][1]*scale;
            canvas.stroke('#aaaaaa');
            canvas.line(x_prev, y_prev, x, y);
            x_prev = x;
            y_prev = y;
            canvas.stroke(color);
            for (vertex=1; vertex<path.length; vertex++) {
              var x = path[vertex][0]*scale;
              var y = path[vertex][1]*scale;
              canvas.line(x_prev, y_prev, x, y);
              x_prev = x;
              y_prev = y;
            }
          }
        }
      }
    }
  },

  draw_bboxes : function (canvas, scale) { 
    // draw with bboxes by color
    // only include colors that are in passe
    var stat;
    var xmin;
    var ymin;
    var xmax;
    var ymax;
    var bbox_combined = [Infinity, Infinity, 0, 0];
    // for all job colors
    for (var color in this.getPassesColors()) {
      // draw color bboxes
      stat = this.stats_by_color[color];
      xmin = stat['bbox'][0]*scale;
      ymin = stat['bbox'][1]*scale;
      xmax = stat['bbox'][2]*scale;
      ymax = stat['bbox'][3]*scale;
      canvas.stroke('#dddddd');
      canvas.line(xmin,ymin,xmin,ymax);
      canvas.line(xmin,ymax,xmax,ymax);
      canvas.line(xmax,ymax,xmax,ymin);
      canvas.line(xmax,ymin,xmin,ymin);
      this.bboxExpand(bbox_combined, xmin, ymin);
      this.bboxExpand(bbox_combined, xmax, ymax);
    }
    // draw global bbox
    xmin = bbox_combined[0];
    ymin = bbox_combined[1];
    xmax = bbox_combined[2];
    ymax = bbox_combined[3];
    canvas.stroke('#dddddd');
    canvas.line(xmin,ymin,xmin,ymax);
    canvas.line(xmin,ymax,xmax,ymax);
    canvas.line(xmax,ymax,xmax,ymin);
    canvas.line(xmax,ymin,xmin,ymin);
  },



  // passes and colors //////////////////////////

  addPass : function(mapping) {
    // this describes in what order colors are written
    // and also what intensity and feedrate is used
    // mapping: {'colors':colors, 'feedrate':feedrate, 'intensity':intensity}
    this.passes.push(mapping);
  },

  setPassesFromLasertags : function(lasertags) {
    // lasertags come in this format
    // (pass_num, feedrate, units, intensity, units, color1, color2, ..., color6)
    // [(12, 2550, '', 100, '%', ':#fff000', ':#ababab', ':#ccc999', '', '', ''), ...]
    this.passes = [];
    for (var i=0; i<lasertags.length; i++) {
      var vals = lasertags[i];
      if (vals.length == 11) {
        var pass = vals[0];
        var feedrate = vals[1];
        var intensity = vals[3];
        if (typeof(pass) === 'number' && pass > 0) {
          //make sure to have enough pass widgets
          var passes_to_create = pass - this.passes.length
          if (passes_to_create >= 1) {
            for (var k=0; k<passes_to_create; k++) {
              this.passes.push({'colors':[], 'feedrate':1200, 'intensity':10, 'counts':1})
            }
          }
          pass = pass-1;  // convert to zero-indexed
          // feedrate
          if (feedrate != '' && typeof(feedrate) === 'number') {
            this.passes[pass]['feedrate'] = feedrate;
          }
          // intensity
          if (intensity != '' && typeof(intensity) === 'number') {
            this.passes[pass]['intensity'] = intensity;
          }
          // colors
          for (var ii=5; ii<vals.length; ii++) {
            var col = vals[ii];
            if (col.slice(0,1) == '#') {
              this.passes[pass]['colors'].push(col);
            }
          }
        } else {
          $().uxmessage('error', "invalid lasertag (pass number)");
        }
      } else {
        $().uxmessage('error', "invalid lasertag (num of args)");
      }
    }
  },

  getPasses : function() {
    return this.passes;
  },

  hasPasses : function() {
    if (this.passes.length > 0) {return true}
    else {return false}
  },

  clearPasses : function() {
    this.passes = [];
  },

  getPassesColors : function() {
    var all_colors = {};
    for (var i=0; i<this.passes.length; i++) {
      var mapping = this.passes[i];
      var colors = mapping['colors'];
      for (var c=0; c<colors.length; c++) {
        var color = colors[c];
        all_colors[color] = true;
      }
    }
    return all_colors;
  },

  getAllColors : function() {
    // return list of colors
// C:Raster Start
//    return Object.keys(this.paths_by_color);
    return Object.keys(this.paths_by_color) + Object.keys(this.rasters_by_color);
// C:Raster End
  },

  getColorOrder : function() {
      var color_order = {};
      var color_count = 0;
// I:Raster Start
      // Rasters first
      for (var color in this.rasters_by_color) {
        color_order[color] = color_count;
        color_count++;
      }
      // Then paths
// I:Raster End
      for (var color in this.paths_by_color) {    
        color_order[color] = color_count;
        color_count++;
      }
      return color_order
  },


  // stats //////////////////////////////////////

  calculateBasicStats : function() {
    // calculate bounding boxes and path lengths
    // for each color and also for '_all_'
    // bbox and length only account for feed lines
    // saves results in this.stats_by_color like so:
    // {'_all_':{'bbox':[xmin,ymin,xmax,ymax], 'length':numeral}, '#ffffff':{}, ..}

    var x_prev = 0;
    var y_prev = 0;
    var path_length_all = 0;
    var bbox_all = [Infinity, Infinity, 0, 0];
    var stats_by_color = {};

    for (var color in this.paths_by_color) {
      var path_lenths_color = 0;
      var bbox_color = [Infinity, Infinity, 0, 0];
      var paths = this.paths_by_color[color];
      for (var k=0; k<paths.length; k++) {
        var path = paths[k];
        if (path.length > 1) {
          var x = path[0][0];
          var y = path[0][1];
          this.bboxExpand(bbox_color, x, y);
          x_prev = x;
          y_prev = y;
          for (vertex=1; vertex<path.length; vertex++) {
            var x = path[vertex][0];
            var y = path[vertex][1];
            path_lenths_color += 
              Math.sqrt((x-x_prev)*(x-x_prev)+(y-y_prev)*(y-y_prev));
            this.bboxExpand(bbox_color, x, y);
            x_prev = x;
            y_prev = y;
          }
        }
      }
// C:Raster Start
//      stats_by_color[color] = {
//        'bbox':bbox_color,
//        'length':path_lenths_color
//      }
//      // add to total also
//      path_length_all += path_lenths_color;
//      this.bboxExpand(bbox_all, bbox_color[0], bbox_color[1]);
//      this.bboxExpand(bbox_all, bbox_color[2], bbox_color[3]);
//    }
      if (paths.length) {
        stats_by_color[color] = {
          'bbox':bbox_color,
          'length':path_lenths_color
        }
        // add to total also
        path_length_all += path_lenths_color;
        this.bboxExpand(bbox_all, bbox_color[0], bbox_color[1]);
        this.bboxExpand(bbox_all, bbox_color[2], bbox_color[3]);
      }
    }

    // rasters
    for (var color in this.rasters_by_color) {
      var raster_lengths_color = 1;
      var bbox_color = [Infinity, Infinity, 0, 0];
      var rasters = this.rasters_by_color[color];
      if (rasters) {
        for (var k=0; k<rasters.length; k++) {
          var raster = rasters[k];
          var x = raster[0][0];
          var y = raster[0][1];
          var width = raster[1][0];
          var height = raster[1][1];
          this.bboxExpand(bbox_color, x, y);
          this.bboxExpand(bbox_color, x + width, y + height);
        }
	  }
	  if (rasters.length) {
        stats_by_color[color] = {
          'bbox':bbox_color,
          'length':raster_lengths_color
        }
        // add to total also
        path_length_all += raster_lengths_color;
        this.bboxExpand(bbox_all, bbox_color[0], bbox_color[1]);
        this.bboxExpand(bbox_all, bbox_color[2], bbox_color[3]);
      }
    }
// C:Raster End
    stats_by_color['_all_'] = {
      'bbox':bbox_all,
      'length':path_length_all
    }
    this.stats_by_color = stats_by_color;
  },


  bboxExpand : function(bbox, x, y) {
    if (x < bbox[0]) {bbox[0] = x;}
    else if (x > bbox[2]) {bbox[2] = x;}
    if (y < bbox[1]) {bbox[1] = y;}
    else if (y > bbox[3]) {bbox[3] = y;}
  },

  getJobPathLength : function() {
    var total_length = 0;
    for(var i in this.passes) {
      var colors = this.passes[i].colors;
      var counts = this.passes[i].counts;
      for(var color in colors) {
        var stat = this.stats_by_color[colors[color]];
        total_length += stat['length'] * counts;
      }
    }
    return total_length;
  },

  getJobBbox : function() {
    var total_bbox = [Infinity, Infinity, 0, 0];
    for (var color in this.getPassesColors()) {
      stat = this.stats_by_color[color];
      this.bboxExpand(total_bbox, stat['bbox'][0], stat['bbox'][1]);
      this.bboxExpand(total_bbox, stat['bbox'][2], stat['bbox'][3]);
    }
    return total_bbox;
  },

  getJobPathLengthByColor : function(color) {

    var stat = this.stats_by_color[color];
    return stat['length'];
  },

  // path optimizations /////////////////////////

  segmentizeLongLines : function() {
    var x_prev = 0;
    var y_prev = 0;
    var d2 = 0;
    var length_limit = app_settings.max_segment_length;
    var length_limit2 = length_limit*length_limit;

    var lerp = function(x0, y0, x1, y1, t) {
      return [x0*(1-t)+x1*t, y0*(1-t)+y1*t];
    }

    for (var color in this.paths_by_color) {
      var paths = this.paths_by_color[color];
      for (var k=0; k<paths.length; k++) {
        var path = paths[k];
        if (path.length > 1) {
          var new_path = [];
          var copy_from = 0;
          var x = path[0][0];
          var y = path[0][1];
          // ignore seek lines for now
          x_prev = x;
          y_prev = y;
          for (vertex=1; vertex<path.length; vertex++) {
            var x = path[vertex][0];
            var y = path[vertex][1];
            d2 = (x-x_prev)*(x-x_prev) + (y-y_prev)*(y-y_prev);
            // check length for each feed line
            if (d2 > length_limit2) {
              // copy previous verts
              for (var n=copy_from; n<vertex; n++) {
                new_path.push(path[n]);
              }
              // add lerp verts
              var t_step = 1/(Math.sqrt(d2)/length_limit);
              for(var t=t_step; t<0.99; t+=t_step) {
                new_path.push(lerp(x_prev, y_prev, x, y, t));
              }
              copy_from = vertex;
            }
            x_prev = x;
            y_prev = y;
          }
          if (new_path.length > 0) {
            // add any rest verts from path
            for (var p=copy_from; p<path.length; p++) {
              new_path.push(path[p]);
            }
            copy_from = 0;
            paths[k] = new_path;
          }
        }
      }
    }
  },


  // auxilliary /////////////////////////////////

  mapConstrainFeedrate : function(rate) {
    rate = parseInt(rate);
    if (rate < .1) {
      rate = .1;
      $().uxmessage('warning', "速度は0.1以上に設定してください。");
    } else if (rate > 8000) {
      rate = 8000;
      $().uxmessage('warning', "速度は8000以下に設定してください。");
    }
    return rate.toString();
  },
    
  mapConstrainIntesity : function(intens) {
    intens = parseInt(intens);
    if (intens < 0) {
      intens = 0;
      $().uxmessage('warning', "出力パワーは0%以上に設定してください。");
    } else if (intens > 100) {
      intens = 100;
      $().uxmessage('warning', "出力パワーは100%以下に設定してください。");
    }
    //map to 255 for now until we change the backend
    return Math.round(intens * 2.55).toString();
  },

}